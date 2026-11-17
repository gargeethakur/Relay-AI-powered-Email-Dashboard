// AI layer. Uses the Anthropic API when ANTHROPIC_API_KEY is set; otherwise a transparent rule-based engine.
const KEY = () => process.env.ANTHROPIC_API_KEY;
const MODEL = () => process.env.AI_MODEL || 'claude-sonnet-4-6';
export const aiMode = () => (KEY() ? 'live' : 'simulated');

async function llm(system, user, max = 900) {
  if (!KEY()) return null;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY(), 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL(), max_tokens: max, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!r.ok) throw new Error(`LLM ${r.status}`);
    const j = await r.json();
    return j.content.map((c) => c.text || '').join('').trim();
  } catch (e) {
    console.warn('[ai] falling back to rule-based engine:', e.message);
    return null;
  }
}
const parseJSON = (t) => { try { return JSON.parse(t.replace(/```json|```/g, '').trim()); } catch { return null; } };

/* ---------- date extraction ---------- */
const WD = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const MO = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
const TIME = '\\d{1,2}(?::\\d{2})?\\s?(?:am|pm)';
const DATE_RE = new RegExp(`\\b(?:(?:${WD})(?:,?\\s*(?:at\\s*)?${TIME})?|(?:${MO})[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*(?:at\\s*)?${TIME})?)`, 'gi');
const DATE_TEST = new RegExp(DATE_RE.source, 'i');
export function findDates(text) {
  const out = [];
  for (const m of text.matchAll(DATE_RE)) { const s = m[0].trim(); if (!out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s); }
  return out.slice(0, 5);
}
export function parseWhen(str, now = new Date()) {
  const t = str.match(new RegExp(TIME, 'i'));
  let h = 9, mi = 0;
  if (t) {
    const p = t[0].toLowerCase().match(/(\d{1,2})(?::(\d{2}))?\s?(am|pm)/);
    h = (+p[1] % 12) + (p[3] === 'pm' ? 12 : 0); mi = p[2] ? +p[2] : 0;
  }
  const wd = str.match(new RegExp(`\\b(${WD})\\b`, 'i'));
  if (wd) {
    const idx = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(wd[1].toLowerCase());
    const d = new Date(now); d.setHours(h, mi, 0, 0);
    let ahead = (idx - now.getDay() + 7) % 7;
    if (ahead === 0 && d <= now) ahead = 7;
    d.setDate(d.getDate() + ahead); return d;
  }
  const mo = str.match(new RegExp(`\\b(${MO})[a-z]*\\.?\\s+(\\d{1,2})`, 'i'));
  if (mo) {
    const m = MO.split('|').indexOf(mo[1].toLowerCase());
    const d = new Date(now.getFullYear(), m, +mo[2], h, mi);
    if (d < now) d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  return null;
}

/* ---------- classification ---------- */
const RULES = {
  no_reply: [
    [/unsubscribe|newsletter|digest|receipt|automated message|do not reply|security alert|new sign-in|order confirmation/i, 3, 'automated or informational message'],
    [/all sorted|resolved|no further action|nothing further|\bfyi\b|for your information/i, 2, 'informational or already resolved'],
  ],
  client_reply: [
    [/\b(approve|approval|sign[- ]?off|resolution|confidential|sensitive|your decision)\b/i, 2, 'asks for a personal decision or approval'],
    [/\b(board|counsel|legal|contract|equity|investor|series [a-d]|term sheet)\b/i, 1.5, 'sensitive business matter'],
    [/\b(performance review|your input|your thoughts|your view|your perspective|your numbers)\b/i, 2, "specifically asks for the client's input"],
    [/\b(dinner|drinks|catch up|birthday|wedding)\b/i, 1.5, 'personal message'],
    [/\b(keynote|fireside)\b/i, 1, 'speaking decision'],
  ],
  assistant_reply: [
    [/\b(re-?schedul\w*|availability|available|time slot|calendar|invite)\b/i, 2, 'scheduling request'],
    [/\b(invoice|payment|purchase order|remittance|quote)\b/i, 2, 'routine billing / admin'],
    [/\b(itinerary|booking|reservation|seat|flight|hotel|logistics|dietary|rsvp|appointment|reminder)\b/i, 2, 'logistics and booking'],
    [/\b(send over|bio|headshot|av requirements|follow(?:ing)? up|status update)\b/i, 1, 'routine request'],
  ],
};
const ACTION_RE = /\b(please|can you|could you|could someone|need(?:s|ed)? (?:you|your|to)|by (?:monday|tuesday|wednesday|thursday|friday|eod|end of)|deadline|due|approve|confirm|sign|kindly|let me know|reply)\b/i;
const MEETING_RE = /\b(meeting|sync|call|appointment|reschedul\w*|itinerary|flight|offsite|dinner|lunch|interview|catch up)\b/i;
const IMPORTANT_RE = /\b(urgent|asap|board|legal|counsel|investor|series [a-d]|contract|deadline|resolution|performance review|signature)\b/i;
const isAuto = (e) => /no-?reply|notifications?@|alerts?@|receipts?@/i.test(e || '');

const lastInbound = (c) => [...c.messages].reverse().find((m) => m.direction === 'in');
const lastMsg = (c) => c.messages[c.messages.length - 1];

export function heuristicClassify(conv) {
  const last = lastMsg(conv);
  const inbound = lastInbound(conv);
  const text = `${conv.subject}\n${inbound?.body || ''}`;
  const tags = [];
  let isImportant = IMPORTANT_RE.test(text);

  if (last.direction === 'out') {
    tags.push('waiting');
    return { label: 'no_reply', confidence: 0.9, reason: 'Last message was sent from this account; waiting on the other party.', tags, isImportant: false };
  }
  const score = { assistant_reply: 0.2, client_reply: 0.2, no_reply: 0.2 };
  const why = { assistant_reply: [], client_reply: [], no_reply: [] };
  for (const [label, rules] of Object.entries(RULES))
    for (const [re, w, note] of rules) if (re.test(text)) { score[label] += w; why[label].push(note); }
  if (isAuto(inbound?.from.email)) { score.no_reply += 3; why.no_reply.push('sent from an automated address'); }
  const priorClient = conv.messages.some((m) => m.direction === 'out' && m.by === 'client');
  const priorAssistant = conv.messages.some((m) => m.direction === 'out' && m.by === 'assistant');
  if (priorClient) { score.client_reply += 1.5; why.client_reply.push('the client personally replied earlier in this thread'); }
  if (priorAssistant) { score.assistant_reply += 1; why.assistant_reply.push('the assistant handled earlier messages in this thread'); }

  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [top, second] = [ranked[0], ranked[1]];
  const confidence = Math.min(0.97, +(0.5 + 0.5 * ((top[1] - second[1]) / (top[1] + second[1]))).toFixed(2));
  const needsReview = confidence < 0.68;
  const reasonParts = why[top[0]];
  let reason = reasonParts.length ? `Detected ${reasonParts.join('; ')}.` : 'No strong signals found.';
  if (needsReview) {
    const alt = why[second[0]];
    reason += alt.length ? ` Also looks like ${alt[0]}, so it is flagged for your review.` : ' Flagged for assistant review.';
  }
  const label = top[0];
  if (label !== 'no_reply' && ACTION_RE.test(text)) tags.push('action_required');
  if (MEETING_RE.test(text) && findDates(text).length) tags.push('meeting');
  return { label, confidence, reason, needsReview, tags, isImportant };
}

export async function classify(conv, ctx = {}) {
  const base = heuristicClassify(conv);
  if (!KEY() || lastMsg(conv).direction === 'out') return { ...base, needsReview: !!base.needsReview, engine: 'rules' };
  const thread = conv.messages.map((m) => `[${m.direction === 'in' ? 'FROM ' + m.from.name : 'SENT by ' + m.by}] ${m.body}`).join('\n---\n');
  const out = await llm(
    `You triage email for a personal assistant who manages the inbox of their client ${ctx.clientName || 'the client'}. Decide who must reply to the latest message. Respond ONLY with JSON: {"label":"assistant_reply|client_reply|no_reply","confidence":0-1,"reason":"one short sentence","action_required":bool,"important":bool}. Use client_reply only for personal decisions, sensitive matters or direct requests for the client. Do not treat every email as needing a reply. Use the thread history.`,
    `Subject: ${conv.subject}\n\n${thread}`, 300);
  const j = out && parseJSON(out);
  if (!j || !['assistant_reply', 'client_reply', 'no_reply'].includes(j.label)) return { ...base, engine: 'rules' };
  const tags = base.tags.filter((t) => t !== 'action_required');
  if (j.action_required && j.label !== 'no_reply') tags.push('action_required');
  const confidence = Math.max(0, Math.min(1, +j.confidence || 0.7));
  return { label: j.label, confidence, reason: j.reason || base.reason, needsReview: confidence < 0.68, tags, isImportant: !!j.important || base.isImportant, engine: 'llm' };
}

/* ---------- summaries ---------- */
const sentences = (t) => t.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter((s) => s.length > 12);
export async function summarize(conv) {
  const inbound = lastInbound(conv) || conv.messages[conv.messages.length - 1];
  const all = conv.messages.map((m) => m.body).join(' ');
  const dates = findDates(all);
  const meetingDate = dates.find((d) => /\d\s?(am|pm)/i.test(d)) || null;
  const live = KEY() && (await llm(
    'Summarise an email thread for a busy personal assistant. Respond ONLY with JSON: {"summary":"2 sentences max","keyPoints":["max 3 short points incl. deadlines/asks"]}.',
    `Subject: ${conv.subject}\n\n` + conv.messages.map((m) => `${m.from.name}: ${m.body}`).join('\n---\n'), 400));
  const j = live && parseJSON(live);
  let summary, keyPoints;
  if (j?.summary) { summary = j.summary; keyPoints = j.keyPoints || []; }
  else {
    const ss = sentences(inbound.body);
    const n = conv.messages.length;
    summary = `${n > 1 ? `${n} messages in this thread. ` : ''}${inbound.from.name} ${ss[0] ? ss[0].replace(/^(Hi|Hello|Hey)[^.!?,]*[,!]?\s*/i, '') : 'sent a message.'}`.replace(/\s+/g, ' ');
    keyPoints = ss.filter((s) => ACTION_RE.test(s) || DATE_TEST.test(s)).slice(0, 3);
  }
  const meeting = MEETING_RE.test(conv.subject + all) && (meetingDate || dates[0])
    ? { title: conv.subject.replace(/^(re|fwd?):\s*/i, ''), when: meetingDate || dates[0] } : null;
  return { summary, keyPoints, dates, meeting };
}

/* ---------- drafts ---------- */
export async function draft(conv, ctx = {}, instruction = '') {
  const inbound = lastInbound(conv);
  const first = (inbound?.from.name || 'there').split(' ')[0];
  const client = ctx.clientName || 'the client';
  const live = await llm(
    `You are ${ctx.assistantName || 'the assistant'}, personal assistant to ${client}. Draft a concise, professional reply (no subject line, sign off with "${ctx.assistantName || 'Assistant'}, on behalf of ${client}"). Never invent commitments the client has not made; use placeholders in [brackets] when information is missing. ${instruction ? 'Extra instruction: ' + instruction : ''}`,
    `Subject: ${conv.subject}\n\n` + conv.messages.map((m) => `${m.from.name}: ${m.body}`).join('\n---\n'), 500);
  if (live) return { body: live, engine: 'llm' };
  const text = `${conv.subject} ${inbound?.body || ''}`;
  const sign = `\n\nKind regards,\n${ctx.assistantName || 'Assistant'}\nOn behalf of ${client}`;
  const dl = findDates(text).filter((d) => !/\d\s?(am|pm)/i.test(d))[0];
  let body;
  if (conv.classification.label === 'client_reply')
    body = `Hi ${first},\n\nThank you for your message. I've passed this directly to ${client}, who will review it and respond personally${dl ? ` ahead of ${dl}` : ' shortly'}.${sign}`;
  else if (/reschedul|availability|slot|meeting|sync|call/i.test(text))
    body = `Hi ${first},\n\nThanks for flagging this. ${client} could do Wednesday at 10:00 AM or Thursday at 4:00 PM. Please let me know which works and I'll send an updated invite.${sign}`;
  else if (/invoice|payment/i.test(text))
    body = `Hi ${first},\n\nThank you for sending this over. The invoice has been received and passed to accounts for processing; payment will be made by the due date. I'll confirm once it's released.${sign}`;
  else if (/itinerary|booking|seat|flight|hotel|dietary|rsvp|appointment|reminder/i.test(text))
    body = `Hi ${first},\n\nThanks for the details. I'm confirming on behalf of ${client}. Please send a final confirmation to this address, and let me know if anything further is needed.${sign}`;
  else body = `Hi ${first},\n\nThank you for your email. I'll look into this and come back to you with an update by end of day tomorrow.${sign}`;
  if (/short|brief|concise/i.test(instruction)) body = body.split('\n\n').slice(0, 2).join('\n\n') + sign;
  return { body, engine: 'rules' };
}

/* ---------- ask your inbox ---------- */
const open = (c) => !c.archived && !c.completed;
const fmt = (list) => list.map((c) => `• ${c.subject} — ${c.messages.find((m) => m.direction === 'in')?.from.name || ''}`).join('\n');
export async function ask(question, convs, selected, ctx = {}) {
  const q = question.toLowerCase();
  const pick = (fn, title, empty) => {
    const l = convs.filter(open).filter(fn).slice(0, 8);
    return { answer: l.length ? `${title} (${l.length}):\n${fmt(l)}` : empty, ids: l.map((c) => c.id) };
  };
  if (KEY() && !/^(show|list)/.test(q) && !/need.*attention|waiting/.test(q)) {
    const ctxText = convs.filter(open).slice(0, 30).map((c) => `#${c.id} | ${c.subject} | label=${c.classification.label} | tags=${c.tags.join(',')} | ${c.summary}`).join('\n');
    const out = await llm(`You answer questions about ${ctx.clientName}'s inbox for their personal assistant. Be concise. Reference conversations by their #id when relevant, e.g. #abc123.`,
      `Inbox:\n${ctxText}\n\n${selected ? `Selected conversation #${selected.id}: ${selected.summary}\n` : ''}Question: ${question}`, 500);
    if (out) return { answer: out, ids: [...out.matchAll(/#([a-z0-9-]{12})/g)].map((m) => m[1]).filter((i) => convs.some((c) => c.id === i)), engine: 'llm' };
  }
  let r;
  if (/why/.test(q) && /(client|assign|assistant|classif)/.test(q)) {
    const c = selected || convs.find((c) => q.includes(c.subject.toLowerCase().slice(0, 12)));
    r = c ? { answer: `"${c.subject}" is assigned to ${c.classification.label === 'client_reply' ? 'the client' : c.classification.label === 'assistant_reply' ? 'the assistant' : 'no one (no reply needed)'}: ${c.classification.reason} Confidence ${Math.round(c.classification.confidence * 100)}%.`, ids: [c.id] }
      : { answer: 'Open a conversation first (or name it) and I can explain why it was assigned.', ids: [] };
  } else if (/summar/.test(q) && selected) r = { answer: `${selected.summary}${selected.keyPoints?.length ? '\n\nKey points:\n' + selected.keyPoints.map((k) => '• ' + k).join('\n') : ''}`, ids: [selected.id] };
  else if (/summar/.test(q)) {
    const o = convs.filter(open);
    const cnt = (l) => o.filter((c) => c.classification.label === l).length;
    r = { answer: `${o.length} open conversations: ${cnt('assistant_reply')} for the assistant, ${cnt('client_reply')} for ${ctx.clientName || 'the client'}, ${cnt('no_reply')} need no reply. ${o.filter((c) => c.classification.needsReview && c.classification.source === 'ai').length} flagged for review.`, ids: [] };
  } else if (/draft/.test(q) && selected) {
    const d = await draft(selected, ctx); r = { answer: `Here's a draft for "${selected.subject}":\n\n${d.body}\n\nOpen the conversation to edit and approve it.`, ids: [selected.id] };
  } else if (/(client|my).*(attention|reply|respond)|need my attention|require.*client/.test(q)) r = pick((c) => c.classification.label === 'client_reply', `${ctx.clientName || 'The client'} needs to reply to`, 'Nothing needs the client personally right now.');
  else if (/waiting|pending|response on/.test(q)) r = pick((c) => c.tags.includes('waiting'), "You're waiting on a response for", 'No conversations are waiting on a response.');
  else if (/meeting|appointment|schedule|calendar/.test(q)) {
    const l = convs.filter(open).filter((c) => c.meeting);
    r = { answer: l.length ? `Upcoming meetings & appointments:\n${l.map((c) => `• ${c.meeting.when} — ${c.meeting.title}`).join('\n')}` : 'No meetings found in email.', ids: l.map((c) => c.id) };
  } else if (/important|urgent/.test(q)) r = pick((c) => c.isImportant, 'Important conversations', 'Nothing is marked important.');
  else if (/action|todo|to-do|follow/.test(q)) r = pick((c) => c.tags.includes('action_required'), 'Emails requiring action', 'No emails currently require action.');
  else if (/assistant.*(reply|handle)|my (reply|queue)/.test(q)) r = pick((c) => c.classification.label === 'assistant_reply', 'Waiting for the assistant to reply', 'The assistant queue is clear.');
  else {
    const words = q.split(/\W+/).filter((w) => w.length > 3);
    const l = convs.filter((c) => words.some((w) => (c.subject + c.summary).toLowerCase().includes(w))).slice(0, 6);
    r = l.length ? { answer: `Conversations matching your question:\n${fmt(l)}`, ids: l.map((c) => c.id) }
      : { answer: 'Try: "Show me emails that need my attention", "What am I waiting for a response on?", "Which emails require the client\'s attention?", or open a conversation and ask "Summarize this conversation".', ids: [] };
  }
  return { ...r, engine: 'rules' };
}
