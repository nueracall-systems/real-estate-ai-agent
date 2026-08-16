// Shared helper for showing a lead's identity consistently across every
// page (Leads, Conversations, Appointments, Bulk Send, etc).
//
// - If we have a name, always show it (e.g. given via Quick Send / Bulk Send).
// - Otherwise, show the number - formatted nicely with country code
//   (+91 XXXXX XXXXX) when it's a real Indian mobile number, or as-is if
//   it's a WhatsApp "lid" (privacy ID) we can't format as a phone number.
export function formatPhone(phone) {
  if (!phone) return '';
  // Indian mobile with country code: 91 + 10 digits = 12 digits total
  if (/^91\d{10}$/.test(phone)) {
    const national = phone.slice(2);
    return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return phone;
}

export function displayIdentity(entity) {
  const name = entity?.name;
  const phone = entity?.phone;

  if (name && name.trim()) return name.trim();
  if (phone) return formatPhone(phone);
  return 'Unknown';
}

// Same idea, for a subtitle/secondary line - the formatted number.
export function displaySubIdentity(entity) {
  return formatPhone(entity?.phone) || '';
}