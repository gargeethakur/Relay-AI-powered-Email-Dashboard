import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Star, MailOpen, Mail, Archive, CheckCheck, ChevronLeft, Sparkles, AlertTriangle, Send, Loader2, PenLine, RefreshCw, Inbox as InboxIcon } from 'lucide-react';
import { api } from '../api.js';
import { SEGMENTS, ago, fullDate } from '../util.js';
import { Avatar, LabelBadge, TagIcons, Skeleton, ErrorState, Empty } from '../components/Bits.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAsk } from '../components/Layout.jsx';
import { LABELS } from '../util.js';

function MailItem({ c, selected, onClick }) {
  const from = c.lastDirection === 'out' ? `To ${c.participants[0].name}` : c.lastFrom.name;
  return (
    <button className={`mail ${LABELS[c.classification.label].cls} ${c.isUnread ? 'unread' : ''} ${selected ? 'sel' : ''}`} onClick={onClick}>
      <div className="l1"><span className="from">{from}</span><TagIcons c={c} /><span className="time">{ago(c.lastMessageAt)}</span></div>
      <div className="subj">{c.subject}</div>
      <div className="snip">{c.summary}</div>
      <div className="l3"><LabelBadge label={c.classification.label} confidence={c.classification.confidence} review={c.classification.needsReview && c.classification.source === 'ai'} />{c.messageCount > 1 && <span className="muted" style={{ fontSize: 12 }}>{c.messageCount} messages</span>}</div>
    </button>
  );
}

function Detail({ id, onChanged, onClose }) {
  const toast = useToast();
  const ask = useAsk();
  const [c, setC] = useState(null);
  const [err, setErr] = useState('');
  const [text, setText] = useState('');
  const [instr, setInstr] = useState('');
  const [composing, setComposing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setC(null); setErr('');
    try {
      let { conversation } = await api(`/conversations/${id}`);
      if (conversation.isUnread) { conversation = (await api(`/conversations/${id}`, { method: 'PATCH', body: { isUnread: false } })).conversation; onChanged(); }
      setC(conversation); setText(conversation.draft?.body || ''); setComposing(!!conversation.draft); setApproved(false);
    } catch (e) { setErr(e.message); }
    // eslint-disable-next-line
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const patch = async (body, msg, leave) => {
    try { const r = await api(`/conversations/${id}`, { method: 'PATCH', body }); setC(r.conversation); onChanged(); if (msg) toast(msg); if (leave) onClose(); }
    catch (e) { toast(e.message, 'err'); }
  };
  async function draft() {
    setBusy('draft');
    try { const r = await api(`/conversations/${id}/draft`, { method: 'POST', body: { instruction: instr } }); setC(r.conversation); setText(r.conversation.draft.body); setComposing(true); setApproved(false); }
    catch (e) { toast(e.message, 'err'); }
    setBusy('');
  }
  async function send() {
    setBusy('send');
    try { const r = await api(`/conversations/${id}/send`, { method: 'POST', body: { body: text, approved } }); setC(r.conversation); setText(''); setComposing(false); setApproved(false); onChanged(); toast('Reply sent. Now waiting for a response.'); }
    catch (e) { toast(e.message, 'err'); }
    setBusy('');
  }

  if (err) return <ErrorState message={err} onRetry={load} />;
  if (!c) return <div className="detail"><Skeleton rows={4} /></div>;
  const k = c.classification;
  const first = c.participants[0];

  return (
    <div className="detail">
      <div className="dhead">
        <div className="toolbar">
          <button className="btn ghost sm back" onClick={onClose}><ChevronLeft size={16} />Inbox</button>
          <span style={{ flex: 1 }} />
          <button className={`iconbtn ${c.isImportant ? 'on' : ''}`} aria-pressed={c.isImportant} title="Mark important" onClick={() => patch({ isImportant: !c.isImportant }, c.isImportant ? 'Removed from important' : 'Marked important')}><Star size={18} fill={c.isImportant ? 'currentColor' : 'none'} /></button>
          <button className="iconbtn" title="Mark as unread" onClick={() => patch({ isUnread: true }, 'Marked as unread', true)}><Mail size={18} /></button>
          <button className="iconbtn" title="Archive" onClick={() => patch({ archived: !c.archived }, c.archived ? 'Restored to inbox' : 'Archived', true)}><Archive size={18} /></button>
          <button className="btn sm" onClick={() => patch({ completed: !c.completed }, c.completed ? 'Reopened' : 'Marked as completed', true)}><CheckCheck size={16} />{c.completed ? 'Reopen' : 'Mark completed'}</button>
          <button className="btn sm" onClick={() => ask('', c.id)}><Sparkles size={15} />Ask AI</button>
        </div>
        <h1>{c.subject}</h1>
        <div className="muted" style={{ fontSize: 13 }}>{first.name} &lt;{first.email}&gt; · {c.provider === 'gmail' ? 'Gmail' : 'Outlook'}</div>
      </div>

      <section className="card ownership">
        <div className="top">
          <h3><Sparkles size={14} /> Who should reply</h3>
          <div className="segctl" role="group" aria-label="Reply responsibility">
            {Object.entries(LABELS).map(([key, l]) => (
              <button key={key} className={k.label === key ? `on ${l.cls}` : ''} aria-pressed={k.label === key} onClick={() => k.label !== key && patch({ label: key }, `Changed to "${l.long}"`)}>{l.short}</button>
            ))}
          </div>
        </div>
        <div style={{ color: 'var(--ink-2)' }}>{k.reason}</div>
        <div className="conf">
          {k.source === 'manual' ? <span>Set by you</span> : <><span>AI confidence {Math.round(k.confidence * 100)}%</span><span className="bar"><i style={{ width: `${k.confidence * 100}%` }} /></span></>}
          {k.source === 'ai' && <button className="btn ghost sm" onClick={async () => { try { const r = await api(`/conversations/${id}/reclassify`, { method: 'POST' }); setC(r.conversation); onChanged(); toast('Re-evaluated'); } catch (e) { toast(e.message, 'err'); } }}><RefreshCw size={13} />Re-evaluate</button>}
        </div>
        {k.needsReview && k.source === 'ai' && (
          <div className="reviewbox"><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={16} />The AI isn't sure about this one. Please check the classification.</span><button className="btn sm" onClick={() => patch({ confirm: true }, 'Classification confirmed')}>Looks right</button></div>
        )}
      </section>

      <section className="card summary">
        <h3><Sparkles size={14} /> AI summary</h3>
        <p>{c.summary}</p>
        {c.keyPoints?.length > 0 && <ul>{c.keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>}
        {c.dates?.length > 0 && <div className="dates" aria-label="Dates mentioned">{c.dates.map((d) => <span key={d}>{d}</span>)}</div>}
      </section>

      {c.messages.map((m) => (
        <article key={m.id} className={`card msg ${m.direction}`}>
          <div className="mh"><Avatar name={m.from.name} size={30} /><div style={{ flex: 1 }}><b>{m.direction === 'out' ? (m.by === 'client' ? `${m.from.name} (client)` : 'Sent by assistant') : m.from.name}</b><br /><small>{fullDate(m.ts)}</small></div></div>
          <div className="body">{m.body}</div>
        </article>
      ))}

      <section className="card composer">
        <h3><PenLine size={14} /> Reply</h3>
        {!composing ? (
          <div className="draftbar">
            <input type="text" value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Optional: guide the AI (e.g. keep it brief)" aria-label="Draft instruction" />
            <button className="btn primary" onClick={draft} disabled={!!busy}>{busy === 'draft' ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}Draft with AI</button>
            <button className="btn" onClick={() => setComposing(true)}>Write my own</button>
          </div>
        ) : (
          <>
            {c.draft && <div className="simnote" style={{ color: 'var(--ink-3)' }}>{c.draft.engine === 'llm' ? 'AI-generated draft. Review before sending.' : 'Template draft from the simulated AI. Review before sending.'}</div>}
            <textarea value={text} onChange={(e) => { setText(e.target.value); setApproved(false); }} aria-label="Reply body" />
            <div className="draftbar">
              <input type="text" value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Redraft instruction (e.g. shorter)" aria-label="Redraft instruction" />
              <button className="btn" onClick={draft} disabled={!!busy}>{busy === 'draft' ? <Loader2 className="spin" size={16} /> : <RefreshCw size={15} />}Redraft</button>
            </div>
            <label className="approve"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />I've reviewed this reply and approve sending it</label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => { setComposing(false); setText(''); }}>Discard</button>
              <button className="btn primary" disabled={!approved || text.trim().length < 3 || !!busy} onClick={send}>{busy === 'send' ? <Loader2 className="spin" size={16} /> : <Send size={15} />}Approve &amp; send</button>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>Prototype: sending is simulated and adds the reply to this conversation.</p>
          </>
        )}
      </section>
    </div>
  );
}

export default function Inbox() {
  const [params, setParams] = useSearchParams();
  const segment = params.get('segment') || 'all';
  const selected = params.get('id');
  const [q, setQ] = useState('');
  const [qd, setQd] = useState('');
  const [acct, setAcct] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [list, setList] = useState(null);
  const [counts, setCounts] = useState({});
  const [err, setErr] = useState('');

  useEffect(() => { const t = setTimeout(() => setQd(q), 250); return () => clearTimeout(t); }, [q]);
  useEffect(() => { api('/accounts').then((d) => setAccounts(d.accounts)).catch(() => {}); }, []);
  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ segment, q: qd, ...(acct ? { accountId: acct } : {}) });
      const [l, s] = await Promise.all([api(`/conversations?${qs}`), api('/stats')]);
      setList(l.conversations); setCounts(s.counts); setErr('');
    } catch (e) { setErr(e.message); }
  }, [segment, qd, acct]);
  useEffect(() => { load(); }, [load]);

  const setSeg = (k) => { const p = new URLSearchParams(params); p.set('segment', k); p.delete('id'); setParams(p); };
  const select = (id) => { const p = new URLSearchParams(params); if (id) p.set('id', id); else p.delete('id'); setParams(p); };

  return (
    <div className={`inbox ${selected ? 'has-sel' : ''}`}>
      <div className="col-list">
        <div className="head">
          <h1 className="page-title" style={{ fontFamily: 'var(--serif)', fontWeight: 500 }}>Inbox</h1>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--ink-3)' }} />
            <input type="search" placeholder="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 32 }} aria-label="Search conversations" />
          </div>
          {accounts.length > 1 && <select value={acct} onChange={(e) => setAcct(e.target.value)} aria-label="Filter by account"><option value="">All accounts</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}</select>}
          <div className="segs" role="tablist">
            {SEGMENTS.map((s) => <button key={s.key} role="tab" aria-selected={segment === s.key} className={`seg ${segment === s.key ? 'on' : ''}`} onClick={() => setSeg(s.key)}>{s.name}{counts[s.key] != null && <small>{counts[s.key]}</small>}</button>)}
          </div>
        </div>
        <div className="items">
          {err && <ErrorState message={err} onRetry={load} />}
          {!list && !err && <Skeleton />}
          {list?.length === 0 && <Empty icon={InboxIcon} title={qd ? 'No matches' : 'Nothing here'} hint={qd ? `No conversations match "${qd}".` : 'No conversations in this segment right now.'} />}
          {list?.map((c) => <MailItem key={c.id} c={c} selected={c.id === selected} onClick={() => select(c.id)} />)}
        </div>
      </div>
      <div className="col-detail">
        {selected ? <Detail key={selected} id={selected} onChanged={load} onClose={() => select(null)} />
          : <Empty icon={MailOpen} title="Select a conversation" hint="Open a conversation to see the AI summary, who should reply and a draft response." />}
      </div>
    </div>
  );
}
