const BASE = import.meta.env.VITE_API_URL || '/api';

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('pa_token');
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check that the API is running on port 5000.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { localStorage.removeItem('pa_token'); window.dispatchEvent(new Event('pa-logout')); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}
