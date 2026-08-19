// ============================================================
// AI ENGINE - Groq-powered conversation brain
// ============================================================
// Builds a per-client system prompt from their profile + live
// property data, then generates a reply. Strict instructions
// are used to prevent hallucination (AI must never invent price
// or property details that aren't in the database).
// ============================================================

import { groq, GROQ_MODEL } from '../config/groqClient.js';
import { supabaseAdmin } from '../config/supabaseClient.js';
import { logger } from '../utils/logger.js';

const FALLBACK_REPLY =
  "Dhanyawad aapke message ke liye! Hamari team jaldi hi aapko detail mein reply karegi.";

/**
 * Builds the system prompt for a client using their profile + active properties.
 */
async function buildSystemPrompt(clientId, existingMemory) {
  const { data: profile } = await supabaseAdmin
    .from('client_profile')
    .select('*, clients(business_name)')
    .eq('client_id', clientId)
    .single();

  const { data: properties } = await supabaseAdmin
    .from('properties')
    .select('title, property_type, bhk_type, location, price, area_gaj, status, description, listing_category, land_area_bigha, developer_name, possession_date, rera_number, total_units, amenities')
    .eq('client_id', clientId)
    .eq('status', 'available')
    .limit(30);

  const { data: client } = await supabaseAdmin
    .from('clients')
    .select('business_name')
    .eq('id', clientId)
    .single();

  // Active/upcoming DND windows - the AI must never confirm a visit inside
  // one of these. Only future-relevant ones (end_time in the future) are
  // worth telling the AI about.
  const { data: blocks } = await supabaseAdmin
    .from('emergency_blocks')
    .select('start_time, end_time, reason')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .gte('end_time', new Date().toISOString());

  const blockList = (blocks || [])
    .map((b) => {
      const start = new Date(b.start_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
      const end = new Date(b.end_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
      return `- ${start} to ${end}${b.reason ? ` (${b.reason})` : ''}`;
    })
    .join('\n');

  const propertyList = (properties || [])
    .map((p) => {
      if (p.listing_category === 'project') {
        const parts = [
          `- [PROJECT] ${p.title}`,
          `Unit types: ${p.bhk_type || 'not specified'}`,
          `Location: ${p.location}`,
          `Starting Price: ₹${p.price} onwards`,
        ];
        if (p.land_area_bigha) parts.push(`Total Land Area: ${p.land_area_bigha} bigha`);
        if (p.developer_name) parts.push(`Developer: ${p.developer_name}`);
        if (p.total_units) parts.push(`Total Units: ${p.total_units}`);
        if (p.possession_date) parts.push(`Possession: ${p.possession_date}`);
        if (p.rera_number) parts.push(`RERA No: ${p.rera_number}`);
        if (p.amenities) parts.push(`Amenities: ${p.amenities}`);
        if (p.description) parts.push(p.description);
        return parts.join(' | ');
      }
      return `- ${p.title} | ${p.bhk_type || ''} ${p.property_type} | Location: ${p.location} | Price: ₹${p.price} | Area: ${p.area_gaj ? `${p.area_gaj} gaj` : 'not specified'} | ${p.description || ''}`;
    })
    .join('\n');

  const tone = profile?.ai_tone || 'friendly';
  const greeting = profile?.greeting_message || 'Namaste!';
  const businessName = client?.business_name || 'our agency';
  const customInstructions = profile?.ai_instructions || '';

  // Current date/time in IST, so the AI can correctly resolve relative
  // dates the customer mentions ("kal", "parso", "is weekend", etc.)
  const nowIST = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `You are a professional real estate sales assistant working on WhatsApp for "${businessName}".
Speak in a ${tone} tone, mixing Hindi and English naturally (Hinglish), the way Indian real estate agents talk to clients on WhatsApp.

CURRENT DATE & TIME (IST): ${nowIST}

STRICT RULES (never break these):
1. ONLY use property information provided below. NEVER invent a price, location, or detail that isn't listed.
2. If you don't have information the customer asks for, say you'll confirm and get back to them - do NOT guess. This applies strongly to plot/area size in "gaj" (a common unit in North Indian real estate, 1 gaj = 1 square yard = 9 sq ft) - customers very often ask this right after BHK. If a property's Area is listed as "not specified" above, do NOT estimate or make up a gaj number (even a rough one) - it could be badly wrong and embarrass the business. Instead say something like "exact area abhi confirm nahi hai, site visit ya call par pakka bata denge" and move the conversation forward.
2c. Whenever you tell the customer you'll "confirm and get back" on something (per rule 2, or anything else you genuinely don't know), you MUST also end that reply with a hidden tag in EXACTLY this format on its own line:
[[QUESTION: a clear, complete restatement of exactly what the customer wants to know]]
   This routes the question to a real person who will answer it - without this tag, the customer's "I'll confirm and get back" promise goes nowhere and no one ever follows up, which is worse than not promising at all. Write the question clearly enough that someone with no other context could answer it correctly (e.g. "What is the exact plot area in gaj for the 3BHK listing in Sector 62?" not just "area"). Never show this bracket line to the customer. If you already asked this exact question earlier in this conversation and got no update yet (check memory below), don't tag it again - only tag it once per new unknown.
2b. Listings marked [PROJECT] are big society/township developments (land measured in bigha, possibly many units/plots of different types), not a single flat. Talk about them accordingly: the price is a "starting from" price (not one fixed unit's price), mention the developer/RERA number/possession date/amenities when relevant and available, and if the customer wants a specific unit within the project, tell them you'll help narrow it down or that the team will share exact unit options during the call/visit. Listings without [PROJECT] are a single specific unit (flat/floor/plot) - talk about those normally.
3. Keep replies short and WhatsApp-friendly (2-4 sentences max), not long essays.
4. Try to understand the customer's budget, preferred location, and urgency naturally in conversation.
5. You handle everything yourself, including scheduling site visits - there is no human agent taking over. Follow this exact TWO-STEP flow for booking, never skip the second step:
   STEP 1 (propose): When the customer wants to schedule a site visit, agree on ONE specific date and time with them (use the current date/time above to resolve words like "kal" or "is weekend"). Once you have a specific date and time in mind, say it back to them clearly and explicitly ask them to confirm - for example "Kya main aapke liye [date] ko [time] pe visit confirm kar doon?" Do NOT include the [[APPOINTMENT: ...]] tag on this message - you are only proposing, not booking yet.
   STEP 2 (book): Only on a LATER message, once the customer has clearly said yes/confirmed (e.g. "haan", "yes", "confirm", "ok pakka", "theek hai book kar do") to that specific proposed date and time, reply confirming the booking in plain words AND include the tag in EXACTLY this format on its own line:
[[APPOINTMENT: YYYY-MM-DD HH:MM]]
   Use 24-hour time. Never include this tag while still proposing or negotiating - only on the message where the customer has just explicitly confirmed. If the visit was already booked earlier in this conversation (check your memory below) and the customer is just acknowledging or chit-chatting about it, do NOT include the tag again.
   NEVER propose or confirm a time that falls inside a blocked window listed below - if the customer asks for a time in a blocked window, politely say that slot isn't available and suggest a nearby time instead.
   Never show the bracket tag line to the customer as a sentence - it is a hidden instruction to our system, so make sure your visible reply text above it already reads naturally on its own.
6. Never discuss anything unrelated to real estate/properties.
7. You have a PERSISTENT MEMORY of this customer (shown below, if any) - this is not a fresh conversation each time, treat everything in it as things you already know and NEVER ask the customer to repeat information you already have. After every reply, end with a hidden memory tag in EXACTLY this format on its own line:
[[MEMORY: one or two short sentences summarizing everything important known about this customer so far - budget, preferred location/area, BHK/property type wanted, family size or purpose (self-use/investment/rental), urgency, any property they showed interest in, any commitments made (e.g. site visit booked), and anything else worth remembering]]
   Always write the FULL updated memory (not just what's new) - it replaces what we had before. If truly nothing meaningful is known yet, write [[MEMORY: none yet]]. This tag must always be the very last line, after the [[APPOINTMENT: ...]] line if that is also present. Never mention this tag to the customer.

${existingMemory && existingMemory !== 'none yet' ? `WHAT YOU ALREADY KNOW ABOUT THIS CUSTOMER (from earlier in the conversation - treat as established fact, do not ask again):\n${existingMemory}\n` : ''}
GREETING STYLE (use similar tone, not verbatim every time): "${greeting}"

${customInstructions ? `ADDITIONAL BUSINESS INSTRUCTIONS:\n${customInstructions}\n` : ''}

${blockList ? `BLOCKED TIMES - do NOT propose or confirm a visit in these windows, suggest a different time instead:\n${blockList}\n` : ''}
AVAILABLE PROPERTIES (only reference these):
${propertyList || 'No properties currently listed - politely tell the customer new listings are coming soon.'}
`;
}

/**
 * Looks for the hidden [[APPOINTMENT: YYYY-MM-DD HH:MM]] tag the AI is
 * instructed to append once a site visit is confirmed. Returns the parsed
 * Date (or null if absent/unparseable) and the reply text with the tag
 * line removed, so the customer never sees the raw tag.
 */
export function extractAppointment(replyText) {
  const tagRegex = /\[\[APPOINTMENT:\s*(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*\]\]/i;
  const match = replyText.match(tagRegex);

  const cleanText = replyText.replace(tagRegex, '').trim();

  if (!match) return { cleanText, scheduledTime: null };

  const [, dateStr, hourStr, minuteStr] = match;
  // Interpret as IST (UTC+5:30)
  const isoWithOffset = `${dateStr}T${hourStr.padStart(2, '0')}:${minuteStr}:00+05:30`;
  const parsed = new Date(isoWithOffset);

  if (isNaN(parsed.getTime())) {
    return { cleanText, scheduledTime: null };
  }

  return { cleanText, scheduledTime: parsed.toISOString() };
}

/**
 * Looks for the hidden [[MEMORY: ...]] tag the AI is instructed to append
 * to every reply, carrying its running summary of the customer. Returns
 * the extracted memory text (or null if absent/empty) and the reply text
 * with the tag line removed.
 */
export function extractMemory(replyText) {
  const tagRegex = /\[\[MEMORY:\s*([\s\S]*?)\s*\]\]/i;
  const match = replyText.match(tagRegex);
  const cleanText = replyText.replace(tagRegex, '').trim();

  if (!match) return { cleanText, memory: null };

  const memory = match[1].trim();
  if (!memory || memory.toLowerCase() === 'none yet') return { cleanText, memory: null };

  return { cleanText, memory };
}

/**
 * Looks for the hidden [[QUESTION: ...]] tag the AI is instructed to add
 * whenever it tells the customer it'll "confirm and get back" on
 * something it doesn't know. Returns the extracted question (or null)
 * and the reply text with the tag removed.
 */
export function extractQuestion(replyText) {
  const tagRegex = /\[\[QUESTION:\s*([\s\S]*?)\s*\]\]/i;
  const match = replyText.match(tagRegex);
  const cleanText = replyText.replace(tagRegex, '').trim();

  if (!match) return { cleanText, question: null };

  const question = match[1].trim();
  if (!question) return { cleanText, question: null };

  return { cleanText, question };
}

/**
 * Generates an AI reply for an incoming lead message, using the last few
 * messages of conversation history for context, plus the lead's
 * persistent memory summary (survives beyond the recent-messages window).
 */
function cleanAIReply(text) {
  if (!text) return '';

  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim();

  // If the model starts a reasoning block but fails to close it,
  // remove everything from the opening tag onward.
  cleaned = cleaned
    .replace(/<think>[\s\S]*$/i, '')
    .replace(/<thinking>[\s\S]*$/i, '')
    .trim();

  return cleaned;
}
export async function generateReply(clientId, leadId, incomingText, conversationHistory = [], existingMemory = null) {
  try {
    const systemPrompt = await buildSystemPrompt(clientId, existingMemory);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map((m) => ({
        role: m.sender === 'lead' ? 'user' : 'assistant',
        content: m.message,
      })),
      { role: 'user', content: incomingText },
    ];

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.6,
      max_tokens: 1000,
    });

    const rawReply = completion.choices?.[0]?.message?.content || '';
    const reply = cleanAIReply(rawReply);
    if (reply) return { reply, usedFallback: false, errorMessage: null };

    logger.error(`Groq returned an empty reply for client ${clientId} (leadId ${leadId}). Full completion: ${JSON.stringify(completion)}`);
    return { reply: FALLBACK_REPLY, usedFallback: true, errorMessage: 'Groq returned an empty response' };
  } catch (err) {
    // Log EVERYTHING we can about the error - this is the #1 place people
    // get stuck ("why is AI just sending a generic message") with no way
    // to tell if it's a bad API key, hit the daily/rate limit, wrong
    // model name, or a network issue. Groq SDK errors usually carry a
    // `status` and `error` body with the real reason.
    const details = err.status ? `status=${err.status} body=${JSON.stringify(err.error || err.response?.data || {})}` : '';
    logger.error(`AI generateReply failed for client ${clientId} (leadId ${leadId}): ${err.message} ${details}`);
    // Rate limit hit or Groq down -> fallback so lead never gets silence
    return { reply: FALLBACK_REPLY, usedFallback: true, errorMessage: `${err.message}${details ? ' | ' + details : ''}` };
  }
}

/**
 * Very lightweight lead-scoring heuristic run alongside AI reply.
 * Keeps cost at zero (no extra API call) by using simple keyword matching.
 * Can be upgraded to an LLM call later once budget allows.
 */
export function scoreLead(text, existingStatus = 'new') {
  const lower = text.toLowerCase();
  const hotKeywords = ['budget hai', 'ready', 'book', 'visit', 'today', 'aaj', 'call me', 'urgent', 'final'];
  const warmKeywords = ['price', 'location', 'details', 'photo', 'interested'];

  if (hotKeywords.some((k) => lower.includes(k))) return 'hot';
  if (warmKeywords.some((k) => lower.includes(k))) return existingStatus === 'hot' ? 'hot' : 'warm';
  return existingStatus === 'new' ? 'warm' : existingStatus;
}



