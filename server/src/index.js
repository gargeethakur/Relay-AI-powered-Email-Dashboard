import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, id } from './store.js';
import { SAMPLE } from './seed.js';
import * as ai from './ai.js';

const app = express();
const SECRET = process.env.JWT_SECRET || 'dev-secret';
app.use(cors());
app.use(express.json());

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => { console.error(e); res.status(500).json({ error: e.message || 'Server error' }); });
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

/* ---------- auth ---------- */
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, clientName: u.clientName });
const sign = (u) => jwt.sign({ id: u.id }, SECRET, { expiresIn: '7d' });
function auth(req, res, next) {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    const u = db.get('users', jwt.verify(t, SECRET).id);
    if (!u) throw new Error();
    req.user = u;
    req.ownerId = u.role === 'client' ? u.assistantId : u.id;
    req.clientName = db.get('users', req.ownerId)?.clientName || 'the client';
    next();
  } catch { bad(res, 'Please log in again.', 401); }
}
const assistantOnly = (req, res, next) => (req.user.role === 'assistant' ? next() : bad(res, 'Assistants only.', 403));

// demo accounts
async function seedDemo() {
  if (db.findOne('users', (u) => u.email === 'assistant@demo.com')) return;
  const assistant = db.insert('users', { name: 'Maya Fernandes', email: 'assistant@demo.com', passwordHash: bcrypt.hashSync('demo1234', 8), role: 'assistant', clientName: 'Alexandra Reyes' });
  db.insert('users', { name: 'Alexandra Reyes', email: 'client@demo.com', passwordHash: bcrypt.hashSync('demo1234', 8), role: 'client', assistantId: assistant.id, clientName: 'Alexandra Reyes' });
  const acc = createAccount(assistant.id, 'gmail', 'alexandra@reyesgroup.com');
  await importSample(acc, assistant);
  db.update('accounts', acc.id, { status: 'connected', lastSync: Date.now() });
}

app.post('/api/auth/signup', wrap(async (req, res) => {
  const { name, email, password, clientName } = req.body || {};
  if (!name || !email || !password) return bad(res, 'Name, email and password are required.');
  if (password.length < 6) return bad(res, 'Password must be at least 6 characters.');
  if (db.findOne('users', (u) => u.email === email.toLowerCase())) return bad(res, 'An account with this email already exists.', 409);
  const u = db.insert('users', { name, email: email.toLowerCase(), passwordHash: bcrypt.hashSync(password, 8), role: 'assistant', clientName: clientName || 'Your client' });
  res.json({ token: sign(u), user: publicUser(u) });
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const u = db.findOne('users', (x) => x.email === (email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(password || '', u.passwordHash)) return bad(res, 'Incorrect email or password.', 401);
  res.json({ token: sign(u), user: publicUser(u) });
}));
app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.get('/api/health', (req, res) => res.json({ ok: true, ai: ai.aiMode() }));

/* ---------- accounts (simulated OAuth + sync) ---------- */
const PROVIDERS = { gmail: 'Gmail', outlook: 'Outlook / Microsoft 365' };
function createAccount(ownerId, provider, email) {
  return db.insert('accounts', { ownerId, provider, email, status: 'syncing', lastSync: null, error: null, connectedAt: Date.now() });
}
async function buildConversation(tpl, account, ownerId, clientName) {
  const now = Date.now();
  const messages = tpl.messages.map((m) => ({ id: id(), from: m.from, direction: m.dir, by: m.by || null, ts: now - m.hoursAgo * 3600e3, body: m.body }));
  const conv = { subject: tpl.subject, messages };
  const cls = await ai.classify({ ...conv, classification: {} }, { clientName });
  const info = await ai.summarize(conv);
  const inbound = messages.find((m) => m.direction === 'in');
  return db.insert('conversations', {
    ownerId, accountId: account.id, provider: account.provider, subject: tpl.subject,
    participants: [inbound.from], messages, lastMessageAt: messages[messages.length - 1].ts,
    classification: { label: cls.label, confidence: cls.confidence, reason: cls.reason, needsReview: !!cls.needsReview, source: 'ai', engine: cls.engine, updatedAt: now },
    tags: cls.tags, isImportant: cls.isImportant, isUnread: !!tpl.unread, archived: false, completed: !!tpl.completed,
    summary: info.summary, keyPoints: info.keyPoints, dates: info.dates, meeting: info.meeting, draft: null, clientStatus: null,
  });
}
async function importSample(account, owner) {
  for (const tpl of SAMPLE[account.provider] || []) await buildConversation(tpl, account, owner.id, owner.clientName);
}

app.get('/api/accounts', auth, assistantOnly, (req, res) => {
  const list = db.find('accounts', (a) => a.ownerId === req.ownerId).map((a) => ({ ...a, emailCount: db.find('conversations', (c) => c.accountId === a.id).length }));
  res.json({ accounts: list, providers: PROVIDERS });
});
app.post('/api/accounts/connect', auth, assistantOnly, wrap(async (req, res) => {
  const { provider, email } = req.body || {};
  if (!PROVIDERS[provider]) return bad(res, 'Unsupported provider.');
  if (!/^\S+@\S+\.\S+$/.test(email || '')) return bad(res, 'Enter a valid email address.');
  if (db.findOne('accounts', (a) => a.ownerId === req.ownerId && a.provider === provider && a.email === email)) return bad(res, 'This account is already connected.', 409);
  const acc = createAccount(req.ownerId, provider, email);
  res.json({ account: acc });
  // simulated initial sync (takes a few seconds so the syncing state is visible)
  setTimeout(async () => {
    try { await importSample(acc, req.user); db.update('accounts', acc.id, { status: 'connected', lastSync: Date.now() }); }
    catch (e) { db.update('accounts', acc.id, { status: 'error', error: 'Initial sync failed. Please retry.' }); }
  }, 2500);
}));
app.post('/api/accounts/:id/sync', auth, assistantOnly, wrap(async (req, res) => {
  const acc = db.get('accounts', req.params.id);
  if (!acc || acc.ownerId !== req.ownerId) return bad(res, 'Account not found.', 404);
  db.update('accounts', acc.id, { status: 'syncing', error: null });
  res.json({ ok: true });
  setTimeout(async () => {
    await simulateIncoming(req.ownerId, acc.id, req.clientName);
    db.update('accounts', acc.id, { status: 'connected', lastSync: Date.now() });
  }, 1800);
}));
app.post('/api/accounts/:id/simulate-error', auth, assistantOnly, (req, res) => {
  const acc = db.get('accounts', req.params.id);
  if (!acc || acc.ownerId !== req.ownerId) return bad(res, 'Account not found.', 404);
  res.json({ account: db.update('accounts', acc.id, { status: 'error', error: 'Access token expired. Reconnect to resume syncing.' }) });
});
app.post('/api/accounts/:id/reconnect', auth, assistantOnly, (req, res) => {
  const acc = db.get('accounts', req.params.id);
  if (!acc || acc.ownerId !== req.ownerId) return bad(res, 'Account not found.', 404);
  res.json({ account: db.update('accounts', acc.id, { status: 'connected', error: null, lastSync: Date.now() }) });
});
app.delete('/api/accounts/:id', auth, assistantOnly, (req, res) => {
  const acc = db.get('accounts', req.params.id);
  if (!acc || acc.ownerId !== req.ownerId) return bad(res, 'Account not found.', 404);
  db.removeWhere('conversations', (c) => c.accountId === acc.id);
  db.removeWhere('accounts', (a) => a.id === acc.id);
  res.json({ ok: true });
});

/* ---------- simulated incoming mail (new message in a thread, or a new thread) ---------- */
const INCOMING_REPLIES = [
  ['Tom Becker', 'tom.becker@northwind.com', 'Re: Northwind contract renewal', 'Following up on the revised proposal. Could you let me know by Friday whether the 6% uplift works for you personally? We would like to close this out.'],
  ['Priya Nair', 'priya.nair@halcyon.io', "Can we move Thursday's leadership sync?", 'Friday at 11:00 AM works for me. Please send the updated invite when you can.'],
  ['Marcus Hale', 'marcus.hale@reyesgroup.com', 'Board resolution — approval needed by Friday', 'Gentle reminder: the resolution still needs your confidential sign-off before Friday.'],
];
const NEW_THREADS = [
  { subject: 'Press inquiry: Forbes profile', from: ['Chloe Barnes', 'chloe.barnes@forbes-media.com'], body: 'Hello, we would like to include Alexandra in our upcoming profile. Could she share her thoughts on leading through the Series B? Interviews are Tuesday at 4:00 PM.' },
  { subject: 'Weekly all-hands notes', from: ['Halcyon Updates', 'noreply@halcyon.io'], body: 'Notes from this week\'s all-hands are attached for your information. This is an automated message.' },
  { subject: 'Room booking confirmation: Q1 planning', from: ['Workspace Bookings', 'rooms@workspace.co'], body: 'Please confirm the room booking for Q1 planning on Monday at 9:00 AM. The reservation will be released if we do not hear back.' },
];
async function simulateIncoming(ownerId, accountId, clientName) {
  const convs = db.find('conversations', (c) => c.ownerId === ownerId && (!accountId || c.accountId === accountId));
  const existing = convs.filter((c) => c.messages.at(-1).direction === 'in' || true);
  const options = INCOMING_REPLIES.map((r) => ({ r, conv: existing.find((c) => c.subject === r[2]) })).filter((o) => o.conv);
  const roll = Math.random();
  if (options.length && roll < 0.5) {
    const { r, conv } = options[Math.floor(Math.random() * options.length)];
    conv.messages.push({ id: id(), from: { name: r[0], email: r[1] }, direction: 'in', by: null, ts: Date.now(), body: r[3] });
    return reclassify(conv, clientName, true);
  }
  const used = new Set(convs.map((c) => c.subject));
  const t = NEW_THREADS.find((n) => !used.has(n.subject));
  const acc = db.get('accounts', accountId) || db.find('accounts', (a) => a.ownerId === ownerId)[0];
  if (!t || !acc) return null;
  return buildConversation({ subject: t.subject, unread: true, messages: [{ dir: 'in', from: { name: t.from[0], email: t.from[1] }, hoursAgo: 0, body: t.body }] }, acc, ownerId, clientName);
}
// Re-classify when a new message arrives, keeping manual overrides unless the thread changed meaningfully.
async function reclassify(conv, clientName, newMessage = false) {
  const cls = await ai.classify(conv, { clientName });
  const info = await ai.summarize(conv);
  const manual = conv.classification.source === 'manual' && !newMessage;
  const patch = { summary: info.summary, keyPoints: info.keyPoints, dates: info.dates, meeting: info.meeting, tags: cls.tags, lastMessageAt: conv.messages.at(-1).ts, archived: newMessage ? false : conv.archived, completed: newMessage ? false : conv.completed, isUnread: newMessage ? true : conv.isUnread };
  if (!manual) {
    patch.classification = { label: cls.label, confidence: cls.confidence, reason: newMessage ? `New message received, so this was re-evaluated. ${cls.reason}` : cls.reason, needsReview: !!cls.needsReview, source: 'ai', engine: cls.engine, updatedAt: Date.now() };
    if (cls.isImportant) patch.isImportant = true;
  }
  if (newMessage) patch.draft = null;
  return db.update('conversations', conv.id, patch);
}
app.post('/api/simulate-incoming', auth, assistantOnly, wrap(async (req, res) => {
  const accs = db.find('accounts', (a) => a.ownerId === req.ownerId && a.status === 'connected');
  if (!accs.length) return bad(res, 'Connect an email account first.');
  const c = await simulateIncoming(req.ownerId, accs[Math.floor(Math.random() * accs.length)].id, req.clientName);
  if (!c) return bad(res, 'No more sample emails to receive. Try resetting the demo data.');
  res.json({ conversation: c });
}));

/* ---------- conversations ---------- */
const open = (c) => !c.archived && !c.completed;
const SEGMENTS = {
  all: open,
  assistant_reply: (c) => open(c) && c.classification.label === 'assistant_reply',
  client_reply: (c) => open(c) && c.classification.label === 'client_reply',
  no_reply: (c) => open(c) && c.classification.label === 'no_reply',
  action_required: (c) => open(c) && c.tags.includes('action_required'),
  waiting: (c) => open(c) && c.tags.includes('waiting'),
  meetings: (c) => open(c) && !!c.meeting,
  important: (c) => open(c) && c.isImportant,
  general: (c) => open(c) && !c.isImportant && !c.meeting && !c.tags.length,
  unread: (c) => open(c) && c.isUnread,
  needs_review: (c) => open(c) && c.classification.needsReview && c.classification.source === 'ai',
  archived: (c) => c.archived,
  completed: (c) => c.completed && !c.archived,
};
const mine = (req) => db.find('conversations', (c) => c.ownerId === req.ownerId).sort((a, b) => b.lastMessageAt - a.lastMessageAt);
const card = (c) => { const { messages, draft, ...rest } = c; const last = messages.at(-1); return { ...rest, messageCount: messages.length, snippet: last.body.slice(0, 140), lastFrom: last.from, lastDirection: last.direction }; };

app.get('/api/conversations', auth, assistantOnly, (req, res) => {
  const { segment = 'all', q = '', accountId, label } = req.query;
  const fn = SEGMENTS[segment] || SEGMENTS.all;
  const term = q.toString().toLowerCase();
  let list = mine(req).filter(fn);
  if (accountId) list = list.filter((c) => c.accountId === accountId);
  if (label) list = list.filter((c) => c.classification.label === label);
  if (term) list = list.filter((c) => (c.subject + c.summary + c.messages.map((m) => m.from.name + m.body).join(' ')).toLowerCase().includes(term));
  res.json({ conversations: list.map(card) });
});
app.get('/api/conversations/:id', auth, assistantOnly, (req, res) => {
  const c = db.get('conversations', req.params.id);
  if (!c || c.ownerId !== req.ownerId) return bad(res, 'Conversation not found.', 404);
  res.json({ conversation: c });
});
app.patch('/api/conversations/:id', auth, assistantOnly, (req, res) => {
  const c = db.get('conversations', req.params.id);
  if (!c || c.ownerId !== req.ownerId) return bad(res, 'Conversation not found.', 404);
  const { label, confirm, isImportant, isUnread, archived, completed } = req.body || {};
  const patch = {};
  for (const [k, v] of Object.entries({ isImportant, isUnread, archived, completed })) if (typeof v === 'boolean') patch[k] = v;
  if (label) {
    if (!['assistant_reply', 'client_reply', 'no_reply'].includes(label)) return bad(res, 'Invalid classification.');
    patch.classification = { ...c.classification, label, source: 'manual', needsReview: false, confidence: 1, reason: `Manually set to "${label.replace('_', ' ')}" by the assistant (was ${c.classification.label.replace('_', ' ')}, AI confidence ${Math.round(c.classification.confidence * 100)}%).`, updatedAt: Date.now() };
  } else if (confirm) patch.classification = { ...c.classification, needsReview: false, source: 'manual', updatedAt: Date.now(), reason: c.classification.reason + ' Confirmed by the assistant.' };
  if (patch.completed) patch.archived = false;
  res.json({ conversation: db.update('conversations', c.id, patch) });
});
app.post('/api/conversations/:id/draft', auth, assistantOnly, wrap(async (req, res) => {
  const c = db.get('conversations', req.params.id);
  if (!c || c.ownerId !== req.ownerId) return bad(res, 'Conversation not found.', 404);
  const d = await ai.draft(c, { clientName: req.clientName, assistantName: req.user.name }, (req.body?.instruction || '').toString());
  res.json({ conversation: db.update('conversations', c.id, { draft: { body: d.body, engine: d.engine, createdAt: Date.now() } }) });
}));
app.post('/api/conversations/:id/send', auth, assistantOnly, wrap(async (req, res) => {
  const c = db.get('conversations', req.params.id);
  if (!c || c.ownerId !== req.ownerId) return bad(res, 'Conversation not found.', 404);
  const { body, approved } = req.body || {};
  if (!approved) return bad(res, 'Review and approve the reply before sending.');
  if (!body || body.trim().length < 3) return bad(res, 'The reply is empty.');
  const owner = db.get('users', req.ownerId);
  const to = c.messages.find((m) => m.direction === 'in');
  c.messages.push({ id: id(), from: { name: owner.clientName, email: db.get('accounts', c.accountId)?.email || '' }, direction: 'out', by: 'assistant', ts: Date.now(), body: body.trim(), to: to?.from });
  c.draft = null; c.isUnread = false; c.clientStatus = null;
  c.classification.source = 'ai'; // sending a reply resets any manual override: the thread now waits on the other party
  const updated = await reclassify(c, req.clientName);
  res.json({ conversation: updated });
}));
app.post('/api/conversations/:id/reclassify', auth, assistantOnly, wrap(async (req, res) => {
  const c = db.get('conversations', req.params.id);
  if (!c || c.ownerId !== req.ownerId) return bad(res, 'Conversation not found.', 404);
  c.classification.source = 'ai';
  res.json({ conversation: await reclassify(c, req.clientName) });
}));

/* ---------- dashboard ---------- */
app.get('/api/stats', auth, assistantOnly, (req, res) => {
  const all = mine(req);
  const counts = Object.fromEntries(Object.entries(SEGMENTS).map(([k, fn]) => [k, all.filter(fn).length]));
  const meetings = all.filter(SEGMENTS.meetings).map((c) => ({ id: c.id, title: c.meeting.title, when: c.meeting.when, date: ai.parseWhen(c.meeting.when)?.getTime() || null, from: c.participants[0]?.name }))
    .sort((a, b) => (a.date || 9e15) - (b.date || 9e15));
  res.json({ counts, total: all.length, meetings, recent: all.filter(open).slice(0, 6).map(card), flagged: all.filter(SEGMENTS.needs_review).map(card) });
});

/* ---------- ask AI ---------- */
app.post('/api/ask', auth, assistantOnly, wrap(async (req, res) => {
  const { question, conversationId } = req.body || {};
  if (!question?.trim()) return bad(res, 'Type a question first.');
  const convs = mine(req);
  const r = await ai.ask(question, convs, convs.find((c) => c.id === conversationId), { clientName: req.clientName, assistantName: req.user.name });
  res.json(r);
}));

/* ---------- client view ---------- */
app.get('/api/client/conversations', auth, (req, res) => {
  const list = mine(req).filter((c) => open(c) && c.classification.label === 'client_reply').map((c) => ({
    id: c.id, subject: c.subject, from: c.participants[0], summary: c.summary, keyPoints: c.keyPoints, reason: c.classification.reason,
    isImportant: c.isImportant, dates: c.dates, lastMessageAt: c.lastMessageAt, clientStatus: c.clientStatus,
    lastMessage: c.messages.at(-1).body, provider: c.provider,
  }));
  res.json({ clientName: req.clientName, conversations: list, preview: req.user.role !== 'client' });
});
app.post('/api/client/conversations/:id/respond', auth, (req, res) => {
  const c = db.get('conversations', req.params.id);
  if (!c || c.ownerId !== req.ownerId) return bad(res, 'Conversation not found.', 404);
  const { action } = req.body || {};
  if (action === 'will_reply') db.update('conversations', c.id, { clientStatus: 'will_reply' });
  else if (action === 'delegate') db.update('conversations', c.id, { clientStatus: null, classification: { ...c.classification, label: 'assistant_reply', source: 'manual', needsReview: false, confidence: 1, reason: 'The client handed this back to the assistant.', updatedAt: Date.now() } });
  else if (action === 'done') db.update('conversations', c.id, { completed: true, clientStatus: 'done' });
  else return bad(res, 'Unknown action.');
  res.json({ ok: true });
});

/* ---------- demo reset + static client ---------- */
app.post('/api/demo/reset', auth, assistantOnly, wrap(async (req, res) => {
  db.removeWhere('conversations', (c) => c.ownerId === req.ownerId);
  db.removeWhere('accounts', (a) => a.ownerId === req.ownerId);
  res.json({ ok: true });
}));

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 5000;
seedDemo().then(() => app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}  (AI mode: ${ai.aiMode()})`)));
