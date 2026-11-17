import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Loader2 } from 'lucide-react';

export default function Welcome() {
  const { login, signup } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '', clientName: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e, creds) {
    e?.preventDefault(); setErr(''); setBusy(true);
    try {
      if (creds) await login(creds);
      else if (mode === 'login') await login({ email: f.email, password: f.password });
      else { await signup(f); nav('/connect'); }
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  return (
    <div className="welcome">
      <section className="hero">
        <div>
          <div className="brand" style={{ padding: 0, marginBottom: 56 }}><span className="mark" />Relay</div>
          <h1>Know who has to answer, before you open the email.</h1>
          <p className="lead">Relay reads every conversation in your client's inbox and decides who should reply: you, your client, or nobody. You stay in control and can correct any call.</p>
        </div>
        <div className="demo-stack" aria-hidden="true">
          <div className="demo-row asst"><span>Can we move Thursday's leadership sync?</span><em>Assistant to reply</em></div>
          <div className="demo-row client"><span>Board resolution: approval needed by Friday</span><em>Client to reply</em></div>
          <div className="demo-row none"><span>Product Weekly: what shipped in November</span><em>No reply needed</em></div>
        </div>
      </section>
      <section className="authwrap">
        <div className="authbox">
          <div className="tabs" role="tablist">
            <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(''); }}>Log in</button>
            <button className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setErr(''); }}>Create account</button>
          </div>
          <h2>{mode === 'login' ? 'Welcome back' : 'Set up your workspace'}</h2>
          <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
            {mode === 'signup' && <>
              <label className="f">Your name<input type="text" required value={f.name} onChange={set('name')} autoComplete="name" /></label>
              <label className="f">Client you assist<input type="text" required value={f.clientName} onChange={set('clientName')} placeholder="e.g. Alexandra Reyes" /></label>
            </>}
            <label className="f">Email<input type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></label>
            <label className="f">Password<input type="password" required minLength={6} value={f.password} onChange={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            {err && <div className="err" role="alert">{err}</div>}
            <button className="btn primary" disabled={busy}>{busy && <Loader2 className="spin" size={16} />}{mode === 'login' ? 'Log in' : 'Create account'}</button>
          </form>
          <div className="demobox">
            <b>Try the demo</b>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={() => submit(null, { email: 'assistant@demo.com', password: 'demo1234' })}>Open as assistant</button>
              <button className="btn sm" onClick={() => submit(null, { email: 'client@demo.com', password: 'demo1234' })}>Open as client</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
