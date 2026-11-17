import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('pa_token'));
  const [aiMode, setAiMode] = useState('simulated');

  useEffect(() => {
    api('/health').then((h) => setAiMode(h.ai)).catch(() => {});
    const out = () => setUser(null);
    window.addEventListener('pa-logout', out);
    if (localStorage.getItem('pa_token')) api('/auth/me').then((d) => setUser(d.user)).catch(() => {}).finally(() => setLoading(false));
    return () => window.removeEventListener('pa-logout', out);
  }, []);

  const authenticate = useCallback(async (path, body) => {
    const d = await api(path, { method: 'POST', body });
    localStorage.setItem('pa_token', d.token);
    setUser(d.user);
    return d.user;
  }, []);
  const logout = () => { localStorage.removeItem('pa_token'); setUser(null); };

  return <Ctx.Provider value={{ user, loading, aiMode, login: (b) => authenticate('/auth/login', b), signup: (b) => authenticate('/auth/signup', b), logout }}>{children}</Ctx.Provider>;
}
