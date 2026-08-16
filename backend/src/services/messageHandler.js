// ============================================================
// MESSAGE HANDLER - the heart of the system
// ============================================================
// Called every time a WhatsApp message arrives for a client.
// Flow:
//   1. Find or create the lead
//   2. Save incoming message to conversations
//   3. Check if AI should handle this (not paused by human takeover)
//   4. Check emergency block / working hours
//   5. Check daily usage limit (Groq rate-limit safety)
//   6. Generate AI reply, save it, send it via WhatsApp
//   7. Update lead score/status, create notification if hot
// ============================================================

import { supabaseAdmin } from '../config/supabaseClient.js';
import { generateReply, scoreLead, extractAppointment, extractMemory, extractQuestion } from '../ai/aiEngine.js';
import { getProvider } from '../whatsapp/whatsappProvider.js';
import { enqueue } from '../utils/queue.js';
import { logger } from '../utils/logger.js';
import { isInEmergencyBlock } from './emergencyBlockService.js';

const MAX_AI_REPLIES_PER_DAY = parseInt(process.env.MAX_AI_REPLIES_PER_CLIENT_PER_DAY || '300');

export async function handleIncomingMessage(clientId, fromNumber, text, jidType = 'phone') {
  // Queue per-client so messages are processed one at a time (safety + order)
  return enqueue(clientId, () => processMessage(clientId, fromNumber, text, jidType));
}

async function processMessage(clientId, fromNumber, text, jidType = 'phone') {
  try {
    // 1. Find or create lead.
    // NOTE ON "@lid": WhatsApp sometimes routes a contact's messages through
    // an opaque "@lid" privacy ID instead of their real phone number. When
    // that happens we must NOT show the customer a confusing internal ID -
    // we keep `phone` as the real number the client actually contacted, and
    // store the lid separately in `whatsapp_lid` (used only to know where
    // to deliver replies).
    let lead = null;

    if (jidType === 'lid') {
      // Have we already linked this exact lid to a lead before?
      const { data: knownLidLead } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('client_id', clientId)
        .eq('whatsapp_lid', fromNumber)
        .maybeSingle();

      lead = knownLidLead || null;
      // NOTE: we deliberately do NOT try to "smart-guess" which existing
      // phone-based lead this lid belongs to. An earlier version tried to
      // auto-link a lid to "the one recent lead who hasn't replied yet",
      // but that guess can be wrong - it would silently merge two
      // completely different customers' conversations into a single
      // thread. The only safe way to link a lid to a known phone number
      // is the `chats.phoneNumberShare` event (see baileysProvider.js),
      // which is WhatsApp explicitly confirming the mapping. Until that
      // happens, a lid contact simply gets and keeps its own lead - a
      // little less tidy, but conversations never get mixed up.
    } else {
      const { data: phoneLead } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('client_id', clientId)
        .eq('phone', fromNumber)
        .maybeSingle();
      lead = phoneLead;
    }

    if (!lead) {
      // Genuinely new contact - no real phone number known for lid-only
      // contacts, so use the lid as a placeholder identifier.
      const insertData = { client_id: clientId, source: 'inbound', status: 'new', jid_type: jidType };
      if (jidType === 'lid') {
        insertData.phone = fromNumber;
        insertData.whatsapp_lid = fromNumber;
      } else {
        insertData.phone = fromNumber;
      }

      const { data: newLead, error } = await supabaseAdmin.from('leads').insert(insertData).select().single();

      if (error) {
        // Postgres unique-violation on (client_id, phone). This happens
        // when an older row already has this exact value sitting in
        // `phone` (e.g. a lid that was saved there before whatsapp_lid
        // existed, or two messages from a brand-new contact arriving at
        // almost the same instant). Either way, the right move is to
        // find and reuse that existing row - NOT to fail the message and
        // leave the customer without a reply.
        if (error.code === '23505') {
          logger.warn(`Lead insert collided on phone=${fromNumber} for client ${clientId} - reusing existing row instead of failing.`);
          const { data: existing, error: refetchErr } = await supabaseAdmin
            .from('leads')
            .select('*')
            .eq('client_id', clientId)
            .eq('phone', fromNumber)
            .maybeSingle();
          if (refetchErr || !existing) throw error; // truly stuck - surface the original error

          lead = existing;
          // Backfill whatsapp_lid/jid_type on this legacy row so future
          // messages from this same contact find it via the normal
          // whatsapp_lid lookup instead of hitting this path again.
          if (jidType === 'lid' && lead.whatsapp_lid !== fromNumber) {
            await supabaseAdmin.from('leads').update({ whatsapp_lid: fromNumber, jid_type: 'lid' }).eq('id', lead.id);
            lead.whatsapp_lid = fromNumber;
            lead.jid_type = 'lid';
          }
        } else {
          throw error;
        }
      } else {
        lead = newLead;
      }
    }

    // Always deliver to the correct WhatsApp address for this lead.
    const sendTarget = lead.jid_type === 'lid' ? (lead.whatsapp_lid || fromNumber) : lead.phone;

    // 2. Save incoming message
    await supabaseAdmin.from('conversations').insert({
      lead_id: lead.id,
      client_id: clientId,
      message: text,
      sender: 'lead',
      status: 'delivered',
    });

    await supabaseAdmin
      .from('leads')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', lead.id);

    // 3. AI handles every conversation end-to-end - no human takeover pause.

    // 4. Check daily usage limit (Groq rate-limit protection)
    const today = new Date().toISOString().split('T')[0];
    const { data: usage } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('client_id', clientId)
      .eq('usage_date', today)
      .single();

    if (usage && usage.ai_replies_count >= MAX_AI_REPLIES_PER_DAY) {
      logger.warn(`Client ${clientId} hit daily AI reply limit.`);
      await notifyClient(clientId, 'usage_limit', 'AI reply limit reached', 'Aaj ke liye AI reply limit poori ho gayi hai. Kripya manually reply karein.');
      return { skipped: true, reason: 'usage_limit' };
    }

    // 5. Get recent conversation history for context. We fetch a much
    // larger window now (30 vs the old 10) - combined with the lead's
    // persistent ai_memory summary (see below), this means the AI has
    // real continuity across long conversations, not just the last
    // couple of exchanges.
    const { data: history } = await supabaseAdmin
      .from('conversations')
      .select('message, sender')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(30);

    const orderedHistory = (history || []).reverse();

    // 6. Generate AI reply - pass the lead's persistent memory summary so
    // it never "forgets" facts learned earlier, even beyond the raw
    // history window or across a very long-running conversation.
    const rawReply = await generateReply(clientId, lead.id, text, orderedHistory, lead.ai_memory);

    // AI may have confirmed a specific site-visit date/time - if so it
    // ends its reply with a hidden [[APPOINTMENT: ...]] tag. Strip that
    // tag out of what the customer actually sees on WhatsApp.
    const { cleanText: afterAppointment, scheduledTime } = extractAppointment(rawReply);
    // AI may have flagged a question it couldn't answer - strip the tag
    // too, the customer never sees it.
    const { cleanText: afterQuestion, question: clientQuestion } = extractQuestion(afterAppointment);
    // AI also maintains a running memory summary via a hidden [[MEMORY: ...]]
    // tag on every reply - extract it and strip it too before sending.
    const { cleanText: replyText, memory: updatedMemory } = extractMemory(afterQuestion);

    if (updatedMemory && updatedMemory !== lead.ai_memory) {
      await supabaseAdmin.from('leads').update({ ai_memory: updatedMemory }).eq('id', lead.id);
    }

    // 7. Send via WhatsApp (using whichever provider this client uses)
    const { data: clientRow } = await supabaseAdmin
      .from('clients')
      .select('whatsapp_provider')
      .eq('id', clientId)
      .single();

    const provider = getProvider(clientRow?.whatsapp_provider || 'baileys');
    await provider.sendMessage(clientId, sendTarget, replyText, lead.jid_type || jidType);

    // 8. Save AI reply + update usage tracking + lead score
    await supabaseAdmin.from('conversations').insert({
      lead_id: lead.id,
      client_id: clientId,
      message: replyText,
      sender: 'ai',
      status: 'sent',
    });

    await supabaseAdmin.from('usage_tracking').upsert(
      {
        client_id: clientId,
        usage_date: today,
        ai_replies_count: (usage?.ai_replies_count || 0) + 1,
        messages_sent_count: (usage?.messages_sent_count || 0) + 1,
      },
      { onConflict: 'client_id,usage_date' }
    );

    const newStatus = scoreLead(text, lead.status);
    if (newStatus !== lead.status) {
      await supabaseAdmin.from('leads').update({ status: newStatus }).eq('id', lead.id);
      if (newStatus === 'hot') {
        await notifyClient(
          clientId,
          'hot_lead',
          'New Hot Lead! 🔥',
          `${lead.name || fromNumber} lagta hai ready to close. Turant follow-up karein.`
        );
      }
    }

    // 8c. AI flagged something it couldn't answer - log it so the client
    // can answer from the dashboard. Once they do, the answer gets sent
    // to this customer automatically (see questionRoutes.js).
    if (clientQuestion) {
      try {
        await supabaseAdmin.from('client_questions').insert({
          client_id: clientId,
          lead_id: lead.id,
          question_text: clientQuestion,
          status: 'pending',
        });
        await notifyClient(
          clientId,
          'question_pending',
          'Customer Question Needs Your Answer',
          `${lead.name || fromNumber} ne kuch poocha jo AI ko pata nahi tha: "${clientQuestion}"`
        );
      } catch (err) {
        logger.error(`Failed to log client question for lead ${lead.id}:`, err.message);
      }
    }

    // 8b. If the AI just confirmed a specific site-visit date/time, book it.
    // NOTE: the AI may end up re-confirming the SAME already-booked visit
    // in a later reply (e.g. customer says "ok thanks, see you then" and
    // the AI naturally reiterates the time) - this must never create a
    // second appointment row. We treat "already has a booked appointment
    // within 1 hour of this time" as the same visit and skip re-booking.
    if (scheduledTime) {
      const windowStart = new Date(new Date(scheduledTime).getTime() - 60 * 60 * 1000).toISOString();
      const windowEnd = new Date(new Date(scheduledTime).getTime() + 60 * 60 * 1000).toISOString();

      const { data: existingAppt } = await supabaseAdmin
        .from('appointments')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('status', 'booked')
        .gte('scheduled_time', windowStart)
        .lte('scheduled_time', windowEnd)
        .maybeSingle();

      if (existingAppt) {
        logger.info(`Lead ${lead.id} already has a booked appointment near ${scheduledTime} (id ${existingAppt.id}) - skipping duplicate.`);
      } else {
        const blocked = await isInEmergencyBlock(clientId, scheduledTime);
        if (blocked) {
          logger.warn(`AI proposed appointment for lead ${lead.id} inside an emergency block window - skipped auto-booking.`);
        } else {
          try {
            await supabaseAdmin.from('appointments').insert({
              client_id: clientId,
              lead_id: lead.id,
              scheduled_time: scheduledTime,
              status: 'booked',
              notes: 'Auto-booked by AI from WhatsApp conversation',
            });
            await notifyClient(
              clientId,
              'appointment_booked',
              'New Appointment Booked by AI',
              `${lead.name || fromNumber} ke saath site visit AI ne book kar diya hai.`
            );
          } catch (err) {
            logger.error(`Failed to auto-book appointment for lead ${lead.id}:`, err.message);
          }
        }
      }
    }

    return { success: true, reply: replyText };
  } catch (err) {
    logger.error(`processMessage failed for client ${clientId}:`, err);
    return { error: err.message };
  }
}

async function notifyClient(clientId, type, title, message) {
  await supabaseAdmin.from('notifications').insert({ client_id: clientId, type, title, message });
}