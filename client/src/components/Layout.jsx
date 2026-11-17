import { useState, createContext, useContext, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Inbox, Plug, Eye, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { Avatar } from './Bits.jsx';
import AskPanel from './AskPanel.jsx';

const AskCtx = createContext(() => {});
export const useAsk = () => useContext(AskCtx);

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/accounts', label: 'Accounts', icon: Plug },
  { to: '/client', label: 'Client view', icon: Eye },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [ask, setAsk] = useState({ open: false, q: '', convId: null, n: 0 });
  const openAsk = useCallback((q = '', convId = null) => setAsk((a) => ({ open: true, q, convId, n: a.n + 1 })), []);

  return (
    <AskCtx.Provider value={openAsk}>
      <div className="shell">
        <aside className="side">
          <div className="brand"><span className="mark" />Relay</div>
          <nav className="nav">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end}><n.icon size={18} />{n.label}</NavLink>)}
          </nav>
          <div className="spacer" />
          <div className="me">
            <Avatar name={user.name} size={34} />
            <div><b>{user.name}</b><small>Assistant to {user.clientName}</small></div>
            <button className="iconbtn" onClick={() => { logout(); nav('/'); }} aria-label="Log out"><LogOut size={17} /></button>
          </div>
        </aside>
        <header className="topbar">
          <div className="brand"><span className="mark" />Relay</div>
          <button className="iconbtn" style={{ color: '#fff' }} onClick={() => { logout(); nav('/'); }} aria-label="Log out"><LogOut size={18} /></button>
        </header>
        <main className="main"><Outlet /></main>
        <nav className="tabbar">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end}><n.icon size={20} />{n.label}</NavLink>)}
        </nav>
      </div>
      {!ask.open && <button className="fab" onClick={() => openAsk()}><Sparkles size={17} /> Ask AI</button>}
      {ask.open && <AskPanel key={ask.n} initial={ask.q} convId={ask.convId} onClose={() => setAsk((a) => ({ ...a, open: false }))} />}
    </AskCtx.Provider>
  );
}
