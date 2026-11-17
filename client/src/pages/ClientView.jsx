import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Undo2, PenLine, ChevronDown, ChevronUp, LogOut, ArrowLeft, PartyPopper } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useToast } from '../components/Toast.jsx';
import { Avatar, Skeleton, ErrorState, Empty } from '../components/Bits.jsx';
import { ago } from '../util.js';

export default function ClientView() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => api('/client/conversations').then((x) => { setD(x); setErr(''); }).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function respond(id, action, msg) {
    try { await api(`/client/conversations/${id}/respond`, { method: 'POST', body: { action } }); toast(msg); load(); }
    catch (e) { toast(e.message, 'err'); }
  }
  const isClient = user.role === 'client';
  const pending = d?.conversations.filter((c) => c.clientStatus !== 'will_reply') || [];

  return (
    <div className="clientwrap">
      {d?.preview && <div className="preview">Preview of what {d.clientName} sees. <Link to="/">Back to dashboard</Link></div>}
      <div className="clientbar">
        <div className="brand" style={{ color: 'var(--ink)', padding: 0 }}><span className="mark" />Relay</div>
        {isClient ? <button className="btn sm" onClick={() => { logout(); nav('/'); }}><LogOut size={15} />Log out</button>
          : <Link className="btn sm" to="/"><ArrowLeft size={15} />Dashboard</Link>}
      </div>
      <div className="clientpage">
        {err && <ErrorState message={err} onRetry={load} />}
        {!d && !err && <Skeleton rows={3} />}
        {d && (
          <>
            <div>
              <h1>{pending.length ? `${pending.length} ${pending.length === 1 ? 'email needs' : 'emails need'} you, ${d.clientName.split(' ')[0]}` : `You're all caught up, ${d.clientName.split(' ')[0]}`}</h1>
              <p className="muted" style={{ marginTop: 4 }}>Only emails that need your personal attention appear here. Your assistant handles the rest.</p>
            </div>
            {d.conversations.length === 0 && <div className="card"><Empty icon={PartyPopper} title="Nothing needs you right now" hint="When an email needs your personal reply, it will show up here." /></div>}
            {d.conversations.map((c) => (
              <article key={c.id} className="card ccard">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Avatar name={c.from.name} /><div style={{ flex: 1 }}><b>{c.from.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{ago(c.lastMessageAt)}{c.isImportant && ' · Important'}</div></div>
                </div>
                <h3>{c.subject}</h3>
                <p>{c.summary}</p>
                {c.dates.length > 0 && <div className="dates">{c.dates.map((x) => <span key={x}>{x}</span>)}</div>}
                <div className="why"><b>Why you:</b> {c.reason}</div>
                {openId === c.id && <div className="card" style={{ padding: 12, whiteSpace: 'pre-wrap', background: 'var(--paper)' }}>{c.lastMessage}</div>}
                <button className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={() => setOpenId(openId === c.id ? null : c.id)}>{openId === c.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{openId === c.id ? 'Hide email' : 'Read email'}</button>
                {c.clientStatus === 'will_reply' ? (
                  <div className="handled"><CheckCircle2 size={17} /> You're replying yourself. Your assistant knows. <button className="btn ghost sm" onClick={() => respond(c.id, 'delegate', 'Handed to your assistant')}>Hand to assistant instead</button></div>
                ) : (
                  <div className="acts">
                    <button className="btn primary" onClick={() => respond(c.id, 'will_reply', "Got it. Your assistant won't reply for you.")}><PenLine size={15} />I'll reply myself</button>
                    <button className="btn" onClick={() => respond(c.id, 'delegate', 'Handed to your assistant')}><Undo2 size={15} />Hand to my assistant</button>
                    <button className="btn" onClick={() => respond(c.id, 'done', 'Marked as done')}><CheckCircle2 size={15} />Already done</button>
                  </div>
                )}
              </article>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
