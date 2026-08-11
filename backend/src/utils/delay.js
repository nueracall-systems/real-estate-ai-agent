// Anti-ban helper: random human-like delay before sending a WhatsApp message.
// WhatsApp flags/bans numbers that reply instantly or send messages back-to-back.
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function humanDelay(minMs, maxMs) {
  const ms = randomBetween(minMs, maxMs);
  await sleep(ms);
  return ms;
}
