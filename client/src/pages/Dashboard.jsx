import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Send, MailPlus, AlertTriangle, CalendarClock, Plug, Loader2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useAsk } from '../components/Layout.jsx';
import { useToast } from '../components/Toast.jsx';
import { Avatar, LabelBadge, TagIcons, Skeleton, ErrorState, Empty } from '../components/Bits.jsx';
import { ago } from '../util.js';

const STATS = [
  ['all', 'Total conversations', ''], ['unread', 'Unread', ''], ['important', 'Important', 'warn'], ['action_required', 'Action required', 'warn'],
  ['waiting', 'Waiting for response', 'none'], ['assistant_reply', 'Assistant to reply', 'asst'], ['client_reply', 'Client to reply', 'client'], ['meetings', 'Meetings & appointments', 'asst'],
];
const ASKS = ['Show me emails that need my attention', 'What am I waiting for a response on?', "Which emails require the client's attention?"];

export default function Dashboard() {
  const { user, aiMode } = useAuth();
  const nav = useNavigate();
  const ask = useAsk();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api('/stats').then((x) => { setD(x); setErr(''); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function simulate() {
    setBusy(true);
    try { const r = await api('/simulate-incoming', { method: 'POST' }); toast(`New email: ${r.conversation.subject}`); await load(); }
    catch (e) { toast(e.message, 'err'); }
    setBusy(false);
  }
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const c = d?.counts;
  const total = c ? c.assistant_reply + c.client_reply + c.no_reply : 0;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h1>{greet}, {user.name.split(' ')[0]}</h1>
          <p className="sub">{c ? <>{c.client_reply} conversations need <b>{user.clientName.split(' ')[0]}</b> and {c.assistant_reply} need you.</> : 'Loading your inbox overview…'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`aipill ${aiMode === 'live' ? '' : 'sim'}`} title={aiMode === 'live' ? 'Using the Anthropic API' : 'Rule-based AI simulation. Add ANTHROPIC_API_KEY on the server for live AI.'}><Sparkles size={12} />{aiMode === 'live' ? 'Live AI' : 'Simulated AI'}</span>
          <button className="btn" onClick={simulate} disabled={busy || !d}>{busy ? <Loader2 className="spin" size={16} /> : <MailPlus size={16} />}Simulate new email</button>
        </div>
      </div>

      <form className="card askbar" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { ask(q); setQ(''); } }}>
        <Sparkles size={18} color="var(--asst)" />
        <input type="text" placeholder="Ask about your emails…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ask about your emails" />
        <button className="btn primary" aria-label="Ask"><Send size={15} /></button>
      </form>
      <div className="chips">{ASKS.map((a) => <button key={a} className="chip" onClick={() => ask(a)}>{a}</button>)}</div>

      {err && <ErrorState message={err} onRetry={load} />}
      {!d && !err && <Skeleton rows={4} />}
      {d && d.total === 0 && (
        <div className="card"><Empty icon={Plug} title="Your inbox is empty" hint="Connect Gmail or Outlook to start sorting conversations." action={<Link className="btn primary" to="/connect">Connect an account</Link>} /></div>
      )}
      {d && d.total > 0 && (
        <>
          {c.needs_review > 0 && (
            <div className="flag"><AlertTriangle size={20} /><div style={{ flex: 1 }}><b>{c.needs_review} {c.needs_review === 1 ? 'conversation needs' : 'conversations need'} your review.</b> The AI wasn't confident about who should reply.</div><button className="btn sm" onClick={() => nav('/inbox?segment=needs_review')}>Review now</button></div>
          )}
          <div className="stats">
            {STATS.map(([k, label, cls]) => (
              <button key={k} className={`stat ${cls}`} onClick={() => nav(`/inbox?segment=${k}`)}><span className="n">{c[k]}</span><span className="l">{label}</span></button>
            ))}
          </div>
          <div className="card split">
            <b>Who needs to respond</b>
            <div className="splitbar" role="img" aria-label={`${c.assistant_reply} assistant, ${c.client_reply} client, ${c.no_reply} no reply`}>
              <i style={{ flex: c.assistant_reply || 0.0001, background: 'var(--asst)' }} /><i style={{ flex: c.client_reply || 0.0001, background: 'var(--client)' }} /><i style={{ flex: c.no_reply || 0.0001, background: 'var(--none)' }} />
            </div>
            <div className="legend">
              <span><b>{c.assistant_reply}</b> Assistant to reply</span><span><b>{c.client_reply}</b> Client to reply</span><span><b>{c.no_reply}</b> No reply needed</span>
              <span className="muted">{total ? Math.round(((c.client_reply + c.assistant_reply) / total) * 100) : 0}% of open conversations need a response</span>
            </div>
          </div>
          <div className="grid2">
            <div className="card">
              <header>Recent conversations <Link to="/inbox" style={{ fontSize: 13, fontWeight: 500 }}>View all</Link></header>
              <div className="list-plain">
                {d.recent.map((m) => (
                  <Link key={m.id} className="row" to={`/inbox?id=${m.id}`}>
                    <Avatar name={m.participants[0].name} />
                    <div className="grow"><div className="t">{m.subject}</div><div className="s">{m.participants[0].name} · {ago(m.lastMessageAt)}</div></div>
                    <TagIcons c={m} /><LabelBadge label={m.classification.label} review={m.classification.needsReview} />
                  </Link>
                ))}
              </div>
            </div>
            <div className="card">
              <header><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CalendarClock size={16} /> Upcoming from email</span></header>
              <div className="list-plain">
                {d.meetings.length === 0 && <p className="muted" style={{ padding: 16 }}>No meetings or appointments found in recent emails.</p>}
                {d.meetings.slice(0, 5).map((m) => (
                  <Link key={m.id} to={`/inbox?id=${m.id}`} className="row meet" style={{ gap: 12 }}>
                    <span className="when">{m.date ? new Date(m.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : m.when}</span>
                    <div className="grow"><div className="t">{m.title}</div><div className="s">{m.when} · {m.from}</div></div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
