import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3600);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
