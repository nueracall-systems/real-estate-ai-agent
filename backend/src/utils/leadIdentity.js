import { supabaseAdmin } from '../config/supabaseClient.js';
import { logger } from './logger.js';

/**
 * Call this right after provider.sendMessage() succeeds. If WhatsApp's
 * lookup revealed this contact actually uses a "@lid" privacy identity
 * (not their plain phone number), we save that lid onto the lead right
 * now - not later, reactively, when a reply happens to arrive mismatched.
 * This is what makes an outbound-started conversation (Quick Send, Bulk
 * Send, a scheduled send) always land the customer's reply on the SAME
 * already-named lead, instead of creating a second, nameless one.
 */
export async function persistResolvedLid(leadId, currentWhatsappLid, sendResult) {
  if (!leadId || !sendResult) return;
  if (sendResult.resolvedJidType !== 'lid' || !sendResult.resolvedLid) return;
  if (currentWhatsappLid === sendResult.resolvedLid) return; // already saved, nothing to do

  try {
    await supabaseAdmin
      .from('leads')
      .update({ whatsapp_lid: sendResult.resolvedLid, jid_type: 'lid' })
      .eq('id', leadId);
  } catch (err) {
    logger.error(`Failed to persist resolved lid for lead ${leadId}:`, err.message);
  }
}