import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const SUGGEST = ['Show me emails that need my attention', 'What am I waiting for a response on?', "Which emails require the client's attention?", 'Summarize my inbox'];
const SUGGEST_CONV = ['Summarize this conversation', 'Why has this email been assigned to the client?', 'Draft a reply to this conversation'];

export default function AskPanel({ initial, convId, onClose }) {
  const nav = useNavigate();
  const { aiMode } = useAuth();
  const [log, setLog] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef();

  async function send(text) {
    if (!text.trim() || busy) return;
    setLog((l) => [...l, { role: 'u', text }]); setQ(''); setBusy(true);
    try {
      const r = await api('/ask', { method: 'POST', body: { question: text, conversationId: convId } });
      setLog((l) => [...l, { role: 'a', text: r.answer, ids: r.ids }]);
    } catch (e) { setLog((l) => [...l, { role: 'a', text: e.message }]); }
    setBusy(false);
  }
  useEffect(() => { if (initial) send(initial); /* eslint-disable-next-line */ }, []);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [log, busy]);

  return (
    <div className="askpanel card" role="dialog" aria-label="Ask AI about your inbox">
      <div className="ph">
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Sparkles size={16} /> Ask about your inbox</span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`aipill ${aiMode === 'live' ? '' : 'sim'}`} style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}>{aiMode === 'live' ? 'Live AI' : 'Simulated AI'}</span>
          <button className="iconbtn" onClick={onClose} aria-label="Close"><X size={17} /></button>
        </span>
      </div>
      <div className="log">
        {!log.length && (
          <>
            <p className="muted">Ask a question in plain English. Replies are never sent without your approval.</p>
            <div className="chips" style={{ marginBottom: 0 }}>
              {(convId ? SUGGEST_CONV : SUGGEST).map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
            </div>
          </>
        )}
        {log.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
            {m.ids?.length > 0 && <div className="refs">{m.ids.slice(0, 6).map((id) => <button key={id} className="chip" onClick={() => { nav(`/inbox?id=${id}`); onClose(); }}>Open #{id.slice(0, 4)}</button>)}</div>}
          </div>
        ))}
        {busy && <div className="bubble a"><Loader2 className="spin" size={16} /></div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(q); }}>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={convId ? 'Ask about this conversation…' : 'Ask about your emails…'} aria-label="Question" />
        <button className="btn primary" disabled={busy || !q.trim()} aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  );
}
