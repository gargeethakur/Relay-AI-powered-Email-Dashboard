import { Star, Zap, CalendarClock, Hourglass, AlertTriangle, Mail, Loader2 } from 'lucide-react';
import { LABELS, initials, hue } from '../util.js';

export function Avatar({ name, size = 36 }) {
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue(name)} 45% 92%)`, color: `hsl(${hue(name)} 50% 28%)` }}>{initials(name)}</span>;
}

export function LabelBadge({ label, confidence, review }) {
  const l = LABELS[label];
  return (
    <span className={`badge ${l.cls}`} title={confidence != null ? `AI confidence ${Math.round(confidence * 100)}%` : undefined}>
      <i className="dot" /> {l.short}{review && <AlertTriangle size={12} aria-label="Needs review" />}
    </span>
  );
}

export function TagIcons({ c }) {
  return (
    <span className="tagicons">
      {c.isImportant && <Star size={14} className="t-imp" fill="currentColor" aria-label="Important" />}
      {c.tags.includes('action_required') && <Zap size={14} className="t-act" aria-label="Action required" />}
      {c.meeting && <CalendarClock size={14} className="t-meet" aria-label="Meeting" />}
      {c.tags.includes('waiting') && <Hourglass size={14} className="t-wait" aria-label="Waiting for response" />}
    </span>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <div className="state"><Loader2 className="spin" size={22} /><span>{label}…</span></div>;
}
export function Skeleton({ rows = 5 }) {
  return <div className="skeletons">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skel" />)}</div>;
}
export function Empty({ icon: Icon = Mail, title, hint, action }) {
  return <div className="state empty"><Icon size={28} /><strong>{title}</strong>{hint && <p>{hint}</p>}{action}</div>;
}
export function ErrorState({ message, onRetry }) {
  return <div className="state error"><AlertTriangle size={26} /><strong>Couldn't load this</strong><p>{message}</p>{onRetry && <button className="btn" onClick={onRetry}>Try again</button>}</div>;
}
export function Modal({ children, onClose, title }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>{children}</div>
    </div>
  );
}
