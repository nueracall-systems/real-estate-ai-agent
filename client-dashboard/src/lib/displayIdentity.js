// Shared helper for showing a lead's identity consistently across every
// page (Leads, Conversations, Appointments, Bulk Send, etc).
//
// - If we have a name, always show it (e.g. given via Quick Send / Bulk Send).
// - Otherwise, always show the full number/ID exactly as WhatsApp gave it
//   to us - whether that's a real phone number or a WhatsApp "lid"
//   (privacy ID). Showing the real thing, always, is more useful to the
//   client than guessing or hiding it behind a generic label.
export function displayIdentity(entity) {
  const name = entity?.name;
  const phone = entity?.phone;

  if (name && name.trim()) return name.trim();
  if (phone) return phone;
  return 'Unknown';
}

// Same idea, for a subtitle/secondary line - just the raw number.
export function displaySubIdentity(entity) {
  return entity?.phone || '';
}