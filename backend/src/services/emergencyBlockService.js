// ============================================================
// EMERGENCY BLOCK (DND) SERVICE
// ============================================================
// When a client sets a "do not disturb" window:
// 1. AI will not offer/confirm any new appointment inside that window
// 2. Any existing appointment falling inside the window gets
//    automatically flagged for reschedule (if auto_reschedule = true)
// ============================================================

import { supabaseAdmin } from '../config/supabaseClient.js';
import { logger } from '../utils/logger.js';

export async function createEmergencyBlock(clientId, { start_time, end_time, reason, auto_reschedule }) {
  const { data: block, error } = await supabaseAdmin
    .from('emergency_blocks')
    .insert({ client_id: clientId, start_time, end_time, reason, auto_reschedule, is_active: true })
    .select()
    .single();

  if (error) throw error;

  if (auto_reschedule) {
    await rescheduleConflictingAppointments(clientId, start_time, end_time);
  }

  return block;
}

async function rescheduleConflictingAppointments(clientId, startTime, endTime) {
  const { data: conflicting } = await supabaseAdmin
    .from('appointments')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'booked')
    .gte('scheduled_time', startTime)
    .lte('scheduled_time', endTime);

  if (!conflicting || conflicting.length === 0) return;

  for (const appt of conflicting) {
    await supabaseAdmin
      .from('appointments')
      .update({ status: 'rescheduled', notes: (appt.notes || '') + ' [Auto-flagged: falls in emergency block window]' })
      .eq('id', appt.id);

    await supabaseAdmin.from('notifications').insert({
      client_id: clientId,
      type: 'appointment',
      title: 'Appointment needs rescheduling',
      message: `Appointment on ${new Date(appt.scheduled_time).toLocaleString('en-IN')} falls in your DND window and was auto-flagged. Please reschedule.`,
    });
  }

  logger.info(`Flagged ${conflicting.length} appointments for reschedule due to emergency block.`);
}

/**
 * Checks if a given timestamp falls inside any active emergency block for a client.
 * Used by the AI reply logic / appointment booking flow before confirming a time.
 */
export async function isInEmergencyBlock(clientId, timestamp) {
  const { data: blocks } = await supabaseAdmin
    .from('emergency_blocks')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .lte('start_time', timestamp)
    .gte('end_time', timestamp);

  return blocks && blocks.length > 0;
}
