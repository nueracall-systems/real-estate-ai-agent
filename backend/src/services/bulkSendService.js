// ============================================================
// BULK SEND SERVICE
// ============================================================
// Sends messages to many leads at once, but with randomized gaps
// between each send (anti-ban). Runs in the background so the
// API request returns immediately; progress can be polled via
// notifications or a bulk_jobs status if you extend this later.
// ============================================================

import { supabaseAdmin } from '../config/supabaseClient.js';
import { getProvider } from '../whatsapp/whatsappProvider.js';
import { humanDelay } from '../utils/delay.js';
import { logger } from '../utils/logger.js';

const MIN_GAP = parseInt(process.env.MIN_BULK_GAP_MS || '5000');
const MAX_GAP = parseInt(process.env.MAX_BULK_GAP_MS || '15000');

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

  (async () => {
    let sent = 0;
    let failed = 0;

    for (const lead of leads) {
      try {
        const personalizedMessage = messageTemplate.replace(/{{\s*name\s*}}/gi, lead.name || 'there');
        const sendTarget = lead.jid_type === 'lid' ? (lead.whatsapp_lid || lead.phone) : lead.phone;

        await provider.sendMessage(clientId, sendTarget, personalizedMessage, lead.jid_type || 'phone');

        await supabaseAdmin.from('conversations').insert({
          lead_id: lead.id,
          client_id: clientId,
          message: personalizedMessage,
          sender: 'human_agent',
          status: 'sent',
        });

        sent++;
      } catch (err) {
        logger.error(`Bulk send (existing leads) failed for lead ${lead.id}:`, err.message);
        failed++;
      }

      await humanDelay(MIN_GAP, MAX_GAP);
    }

    await supabaseAdmin.from('notifications').insert({
      client_id: clientId,
      type: 'system',
      title: 'Bulk Send Complete',
      message: `Sent: ${sent}, Failed: ${failed} out of ${leads.length} messages.`,
    });

    logger.info(`Bulk send (existing leads) done for client ${clientId}: sent=${sent} failed=${failed}`);
  })();

  return { started: true, totalRecipients: leads.length };
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

  // Fire and forget - runs in background, doesn't block the HTTP response
  (async () => {
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
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

        sent++;
      } catch (err) {
        logger.error(`Bulk send failed for ${recipient.phone}:`, err.message);
        failed++;
      }

      // Anti-ban gap between each message in the batch
      await humanDelay(MIN_GAP, MAX_GAP);
    }

    await supabaseAdmin.from('notifications').insert({
      client_id: clientId,
      type: 'system',
      title: 'Bulk Send Complete',
      message: `Sent: ${sent}, Failed: ${failed} out of ${recipients.length} messages.`,
    });

    logger.info(`Bulk send done for client ${clientId}: sent=${sent} failed=${failed}`);
  })();

  return { started: true, totalRecipients: recipients.length };
}