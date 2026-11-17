export const LABELS = {
  assistant_reply: { short: 'Assistant', long: 'Assistant to reply', cls: 'asst' },
  client_reply: { short: 'Client', long: 'Client to reply', cls: 'client' },
  no_reply: { short: 'No reply', long: 'No reply needed', cls: 'none' },
};
export const SEGMENTS = [
  { key: 'all', name: 'All' },
  { key: 'assistant_reply', name: 'Assistant to reply' },
  { key: 'client_reply', name: 'Client to reply' },
  { key: 'no_reply', name: 'No reply needed' },
  { key: 'action_required', name: 'Action required' },
  { key: 'waiting', name: 'Waiting for response' },
  { key: 'meetings', name: 'Meetings & appointments' },
  { key: 'important', name: 'Important' },
  { key: 'general', name: 'General' },
  { key: 'unread', name: 'Unread' },
  { key: 'needs_review', name: 'Needs review' },
  { key: 'completed', name: 'Completed' },
  { key: 'archived', name: 'Archived' },
];
export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d}d ago` : new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
export const fullDate = (ts) => new Date(ts).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const initials = (n = '?') => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const HUES = [215, 160, 28, 280, 340, 190, 95];
export const hue = (s = '') => HUES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
