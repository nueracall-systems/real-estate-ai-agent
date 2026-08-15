// ============================================================
// SCHEDULED BULK SEND (daily auto-send)
// ============================================================
// Lets a client set a time of day + pick a template once, and every
// day at that time the system automatically messages every lead with
// that template - no manual typing needed, ever.
//
// Runs a cron job every minute (IST) that checks: is there an active
// schedule whose send_time matches right now, and hasn't already run
// today? If so, fire the bulk send using startBulkSendToLeads (same
// anti-ban gradual-sending logic as manual Bulk Send).
// ============================================================

import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { startBulkSendToLeads } from './bulkSendService.js';
import { logger } from '../utils/logger.js';

export function startScheduledBulkSendCron() {
  // Every minute
  cron.schedule('* * * * *', async () => {
    try {
      const nowIST = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      const now = new Date(nowIST);
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hh}:${mm}:00`;
      const today = now.toISOString().split('T')[0]; // IST-shifted date, good enough for a once-a-day check

      const { data: dueSchedules } = await supabaseAdmin
        .from('scheduled_bulk_sends')
        .select('*, message_templates(content)')
        .eq('is_active', true)
        .eq('send_time', currentTime)
        .or(`last_sent_date.is.null,last_sent_date.neq.${today}`);

      if (!dueSchedules || dueSchedules.length === 0) return;

      for (const schedule of dueSchedules) {
        try {
          const messageContent = schedule.message_templates?.content;
          if (!messageContent) {
            logger.warn(`Scheduled bulk send ${schedule.id} skipped - its template was deleted.`);
            continue;
          }

          const { data: leads } = await supabaseAdmin
            .from('leads')
            .select('id, name, phone, jid_type, whatsapp_lid')
            .eq('client_id', schedule.client_id);

          if (!leads || leads.length === 0) {
            logger.info(`Scheduled bulk send ${schedule.id} skipped - client has no leads yet.`);
          } else {
            await startBulkSendToLeads(schedule.client_id, leads, messageContent);
            logger.info(`Scheduled bulk send ${schedule.id} triggered for client ${schedule.client_id} (${leads.length} leads).`);
          }

          await supabaseAdmin.from('scheduled_bulk_sends').update({ last_sent_date: today }).eq('id', schedule.id);
        } catch (err) {
          logger.error(`Scheduled bulk send ${schedule.id} failed:`, err.message);
        }
      }
    } catch (err) {
      logger.error('Scheduled bulk send cron tick failed:', err.message);
    }
  });

  logger.info('Scheduled bulk send cron started (checks every minute).');
}