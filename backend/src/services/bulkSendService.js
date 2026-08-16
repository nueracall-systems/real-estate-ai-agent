// ============================================================
// BULK SEND SERVICE
// ============================================================
// Sends messages to many leads at once, but with randomized gaps
// between each send (anti-ban). Runs in the background so the API
// request returns immediately.
//
// Every run creates a `bulk_send_jobs` row and updates it live -
// per-recipient status (sent / failed + reason, e.g. "not on
// WhatsApp") so the client can see exactly what happened, not just a
// final sent/failed count.
// ============================================================

import { supabaseAdmin } from '../config/supabaseClient.js';
import { getProvider } from '../whatsapp/whatsappProvider.js';
import { humanDelay } from '../utils/delay.js';
import { logger } from '../utils/logger.js';

const MIN_GAP = parseInt(process.env.MIN_BULK_GAP_MS || '5000');
const MAX_GAP = parseInt(process.env.MAX_BULK_GAP_MS || '15000');

async function createJob(clientId, totalRecipients) {
  const { data } = await supabaseAdmin
    .from('bulk_send_jobs')
    .insert({ client_id: clientId, total_recipients: totalRecipients, status: 'running' })
    .select()
    .single();
  return data;
}

async function updateJobProgress(jobId, results) {
  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  await supabaseAdmin
    .from('bulk_send_jobs')
    .update({ sent_count: sent, failed_count: failed, results })
    .eq('id', jobId);
}

async function completeJob(jobId, results) {
  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  await supabaseAdmin
    .from('bulk_send_jobs')
    .update({ sent_count: sent, failed_count: failed, results, status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', jobId);
  return { sent, failed };
}

/**
 * Same as startBulkSend, but for leads that already exist in the database
 * (selected from the Bulk Send leads list) instead of a fresh CSV upload.
 * leads: [{ id, name, phone, jid_type, whatsapp_lid }]
 */
export async function startBulkSendToLeads(clientId, leads, messageTemplate) {
  const { data: clientRow } = await supabaseAdmin
    .from('clients')
    .select('whatsapp_provider')
    .eq('id', clientId)
    .single();

  const provider = getProvider(clientRow?.whatsapp_provider || 'baileys');
  const job = await createJob(clientId, leads.length);

  (async () => {
    const results = [];

    for (const lead of leads) {
      const sendTarget = lead.jid_type === 'lid' ? (lead.whatsapp_lid || lead.phone) : lead.phone;
      const displayPhone = lead.phone;

      try {
        // Check registration first (phone-type leads only - lids are
        // already-confirmed WhatsApp contacts by definition, no check needed)
        if (lead.jid_type !== 'lid' && provider.checkOnWhatsApp) {
          const exists = await provider.checkOnWhatsApp(clientId, sendTarget);
          if (exists === false) {
            results.push({ phone: displayPhone, name: lead.name, status: 'failed', reason: 'This number does not have WhatsApp' });
            await updateJobProgress(job.id, results);
            await humanDelay(MIN_GAP, MAX_GAP);
            continue;
          }
        }

        const personalizedMessage = messageTemplate.replace(/{{\s*name\s*}}/gi, lead.name || 'there');
        await provider.sendMessage(clientId, sendTarget, personalizedMessage, lead.jid_type || 'phone');

        await supabaseAdmin.from('conversations').insert({
          lead_id: lead.id,
          client_id: clientId,
          message: personalizedMessage,
          sender: 'human_agent',
          status: 'sent',
        });

        results.push({ phone: displayPhone, name: lead.name, status: 'sent' });
      } catch (err) {
        logger.error(`Bulk send (existing leads) failed for lead ${lead.id}:`, err.message);
        results.push({ phone: displayPhone, name: lead.name, status: 'failed', reason: err.message });
      }

      await updateJobProgress(job.id, results);
      await humanDelay(MIN_GAP, MAX_GAP);
    }

    const { sent, failed } = await completeJob(job.id, results);

    await supabaseAdmin.from('notifications').insert({
      client_id: clientId,
      type: 'system',
      title: 'Bulk Send Complete',
      message: `Sent: ${sent}, Failed: ${failed} out of ${leads.length} messages.`,
    });

    logger.info(`Bulk send (existing leads) done for client ${clientId}: sent=${sent} failed=${failed}`);
  })();

  return { started: true, totalRecipients: leads.length, jobId: job.id };
}

/**
 * recipients: [{ name, phone }]
 * messageTemplate: string, can include {{name}} placeholder
 */
export async function startBulkSend(clientId, recipients, messageTemplate) {
  const { data: clientRow } = await supabaseAdmin
    .from('clients')
    .select('whatsapp_provider')
    .eq('id', clientId)
    .single();

  const provider = getProvider(clientRow?.whatsapp_provider || 'baileys');
  const job = await createJob(clientId, recipients.length);

  // Fire and forget - runs in background, doesn't block the HTTP response
  (async () => {
    const results = [];

    for (const recipient of recipients) {
      try {
        if (provider.checkOnWhatsApp) {
          const exists = await provider.checkOnWhatsApp(clientId, recipient.phone);
          if (exists === false) {
            results.push({ phone: recipient.phone, name: recipient.name, status: 'failed', reason: 'This number does not have WhatsApp' });
            await updateJobProgress(job.id, results);
            await humanDelay(MIN_GAP, MAX_GAP);
            continue;
          }
        }

        const personalizedMessage = messageTemplate.replace(/{{\s*name\s*}}/gi, recipient.name || 'there');

        // Ensure lead exists
        await supabaseAdmin
          .from('leads')
          .upsert(
            { client_id: clientId, phone: recipient.phone, name: recipient.name, source: 'bulk' },
            { onConflict: 'client_id,phone', ignoreDuplicates: false }
          );

        const { data: lead } = await supabaseAdmin
          .from('leads')
          .select('id')
          .eq('client_id', clientId)
          .eq('phone', recipient.phone)
          .single();

        await provider.sendMessage(clientId, recipient.phone, personalizedMessage);

        if (lead) {
          await supabaseAdmin.from('conversations').insert({
            lead_id: lead.id,
            client_id: clientId,
            message: personalizedMessage,
            sender: 'human_agent',
            status: 'sent',
          });
        }

        results.push({ phone: recipient.phone, name: recipient.name, status: 'sent' });
      } catch (err) {
        logger.error(`Bulk send failed for ${recipient.phone}:`, err.message);
        results.push({ phone: recipient.phone, name: recipient.name, status: 'failed', reason: err.message });
      }

      await updateJobProgress(job.id, results);
      // Anti-ban gap between each message in the batch
      await humanDelay(MIN_GAP, MAX_GAP);
    }

    const { sent, failed } = await completeJob(job.id, results);

    await supabaseAdmin.from('notifications').insert({
      client_id: clientId,
      type: 'system',
      title: 'Bulk Send Complete',
      message: `Sent: ${sent}, Failed: ${failed} out of ${recipients.length} messages.`,
    });

    logger.info(`Bulk send done for client ${clientId}: sent=${sent} failed=${failed}`);
  })();

  return { started: true, totalRecipients: recipients.length, jobId: job.id };
}