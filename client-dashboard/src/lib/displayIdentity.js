// Shared helper for showing a lead's identity consistently across every
// page (Leads, Conversations, Appointments, Bulk Send, etc).
//
// - If we have a name, always show it.
// - If phone looks like a real dialable number (Indian mobile with
//   country code = 12 digits, e.g. 919876543210), show it.
// - Otherwise it's a WhatsApp "lid" - an opaque privacy ID WhatsApp
//   assigns instead of the real number for some contacts. Showing that
//   raw 15-digit number looks like a bug, so we label it clearly instead.
export function displayIdentity(entity) {
  const name = entity?.name;
  const phone = entity?.phone;

  if (name && name.trim()) return name.trim();
  if (phone && phone.length <= 12) return phone;
  return 'WhatsApp Contact (no name yet)';
}

// Same idea, but for showing a secondary/subtitle line under the name -
// returns the real phone if we have one, otherwise a short explanatory
// note instead of the raw lid number.
export function displaySubIdentity(entity) {
  const phone = entity?.phone;
  if (phone && phone.length <= 12) return phone;
  return 'Number hidden by WhatsApp privacy - tap name to label this contact';
}