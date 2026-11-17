import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Trash2, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Plug, Bug } from 'lucide-react';
import { api } from '../api.js';
import { useToast } from '../components/Toast.jsx';
import { Modal, Skeleton, ErrorState, Empty } from '../components/Bits.jsx';
import { ago } from '../util.js';

const NAMES = { gmail: 'Gmail', outlook: 'Outlook / Microsoft 365' };

function ConnectModal({ provider, defaultEmail, onClose, onDone }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(defaultEmail);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const name = provider === 'gmail' ? 'Google' : 'Microsoft';

  async function allow() {
    setBusy(true); setErr('');
    try { await api('/accounts/connect', { method: 'POST', body: { provider, email } }); onDone(); }
    catch (e) { setErr(e.message); setStep(1); }
    setBusy(false);
  }
  return (
    <Modal onClose={onClose} title={`Connect ${NAMES[provider]}`}>
      <div className={`plogo ${provider}`} style={{ marginBottom: 12 }}>{provider === 'gmail' ? 'G' : 'O'}</div>
      {step === 1 ? (
        <form onSubmit={(e) => { e.preventDefault(); if (/^\S+@\S+\.\S+$/.test(email)) { setErr(''); setStep(2); } else setErr('Enter a valid email address.'); }} style={{ display: 'grid', gap: 12 }}>
          <h2 style={{ fontSize: 20 }}>Connect {NAMES[provider]}</h2>
          <p className="muted">Enter the mailbox you want to manage. This prototype simulates the sign-in screen below.</p>
          <label className="f">Email address<input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {err && <div className="err" role="alert">{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary">Continue to {name}</button>
          </div>
        </form>
      ) : (
        <div>
          <h2 style={{ fontSize: 20 }}>Relay wants access to {email}</h2>
          <div className="consent">
            <ul>
              <li><ShieldCheck size={16} /> Read your emails and conversation history</li>
              <li><ShieldCheck size={16} /> Draft replies. Nothing is sent until you approve it.</li>
              <li><ShieldCheck size={16} /> See calendar details mentioned in emails</li>
            </ul>
          </div>
          <p className="muted" style={{ fontSize: 12.5 }}>Simulated consent screen: no real {name} credentials are used.</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn" onClick={() => setStep(1)} disabled={busy}>Back</button>
            <button className="btn primary" onClick={allow} disabled={busy}>{busy && <Loader2 className="spin" size={16} />}Allow access</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Accounts({ onboarding }) {
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(() => api('/accounts').then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const syncing = data?.accounts.some((a) => a.status === 'syncing');
  useEffect(() => { if (!syncing) return; const t = setInterval(load, 1000); return () => clearInterval(t); }, [syncing, load]);

  const act = async (fn, msg) => { try { await fn(); if (msg) toast(msg); load(); } catch (e) { toast(e.message, 'err'); } };
  const connected = data?.accounts.filter((a) => a.status !== 'syncing').length > 0;
  const demoEmail = (p) => (p === 'gmail' ? 'alexandra@reyesgroup.com' : 'alexandra.reyes@reyesgroup.onmicrosoft.com');

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      {onboarding && <div className="steps"><b>Step 1 of 2</b> Connect your client's email · Step 2 Open the inbox</div>}
      <h1>{onboarding ? "Connect your client's email" : 'Connected accounts'}</h1>
      <p className="sub">{onboarding ? 'Relay needs access to a mailbox to organise conversations and work out who should reply. You can add more accounts later.' : 'Manage the mailboxes Relay reads and see when each one last synced.'}</p>

      {error && <ErrorState message={error} onRetry={load} />}
      {!data && !error && <Skeleton rows={2} />}
      {data && (
        <>
          <div className="accs" style={{ marginBottom: 22 }}>
            {data.accounts.length === 0 && <div className="card"><Empty icon={Plug} title="No accounts connected yet" hint="Choose Gmail or Outlook below to connect a mailbox." /></div>}
            {data.accounts.map((a) => (
              <div key={a.id} className="card acc">
                <div className={`plogo ${a.provider}`}>{a.provider === 'gmail' ? 'G' : 'O'}</div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <b>{a.email}</b>
                  <div className="muted" style={{ fontSize: 13 }}>{NAMES[a.provider]} · {a.emailCount} conversations{a.lastSync && ` · synced ${ago(a.lastSync)}`}</div>
                  {a.status === 'error' && <div style={{ color: 'var(--bad)', fontSize: 13, marginTop: 2 }}>{a.error}</div>}
                </div>
                <span className={`status ${a.status}`}>
                  {a.status === 'syncing' && <><Loader2 className="spin" size={13} /> Syncing…</>}
                  {a.status === 'connected' && <><CheckCircle2 size={13} /> Connected</>}
                  {a.status === 'error' && <><AlertTriangle size={13} /> Needs attention</>}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {a.status === 'error'
                    ? <button className="btn sm primary" onClick={() => act(() => api(`/accounts/${a.id}/reconnect`, { method: 'POST' }), 'Account reconnected')}>Reconnect</button>
                    : <button className="btn sm" disabled={a.status === 'syncing'} onClick={() => act(() => api(`/accounts/${a.id}/sync`, { method: 'POST' }))}><RefreshCw size={14} /> Sync now</button>}
                  <button className="iconbtn" title="Demo: simulate an expired token" aria-label="Simulate error" onClick={() => act(() => api(`/accounts/${a.id}/simulate-error`, { method: 'POST' }))}><Bug size={16} /></button>
                  <button className="iconbtn" aria-label="Disconnect" onClick={() => { if (confirm(`Disconnect ${a.email}? Its conversations will be removed from Relay.`)) act(() => api(`/accounts/${a.id}`, { method: 'DELETE' }), 'Account disconnected'); }}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
          <h3 style={{ marginBottom: 10 }}>Add an account</h3>
          <div className="providers">
            {Object.keys(data.providers).map((p) => (
              <button key={p} className="provider" onClick={() => setModal(p)}>
                <div className={`plogo ${p}`}>{p === 'gmail' ? 'G' : 'O'}</div>
                <b>{data.providers[p]}</b>
                <span className="muted">Connect with {p === 'gmail' ? 'Google' : 'Microsoft'} sign-in</span>
              </button>
            ))}
          </div>
          {onboarding && (
            <div style={{ marginTop: 26, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn primary" disabled={!connected || syncing} onClick={() => nav('/')}>{syncing ? 'Waiting for sync…' : 'Open my inbox'}</button>
            </div>
          )}
        </>
      )}
      {modal && <ConnectModal provider={modal} defaultEmail={demoEmail(modal)} onClose={() => setModal(null)} onDone={() => { setModal(null); toast('Connected. Syncing your conversations…'); load(); }} />}
    </div>
  );
}
