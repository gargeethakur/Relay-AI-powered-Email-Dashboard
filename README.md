# Relay: AI-powered email dashboard for personal assistants

Prototype for the "Personal Assistant – AI-Powered Email Management Dashboard" assignment.
**Stack:** React (Vite) + Node/Express + a JSON-file database (MongoDB-compatible shape, no install needed).

## Run it

Requires Node 18+.

```bash
npm run install:all     # installs root, server and client
npm run dev             # API on :5000, web app on http://localhost:5173
```

Single-port production style: `npm run build && npm start` then open http://localhost:5000.

**Demo logins** (password `demo1234`): `assistant@demo.com` (Gmail already connected) and `client@demo.com` (client view).
Or create your own account and go through onboarding to connect Gmail / Outlook.

## What each deliverable maps to

| Deliverable | Where |
|---|---|
| Onboarding + email connection | `pages/Welcome.jsx`, `pages/Accounts.jsx` (simulated OAuth consent, syncing / connected / error states, manage accounts) |
| Assistant dashboard | `pages/Dashboard.jsx` (stats, who-needs-to-respond bar, recent, upcoming meetings, review queue) |
| Organization & segments | `pages/Inbox.jsx` (13 segments, search, account filter, URL-persisted so context isn't lost) |
| AI reply classification | `server/src/ai.js` `classify()` → Assistant / Client / No reply, confidence, reason, re-evaluated when a new message arrives, low confidence flagged "Needs review", manual override |
| Client-facing view | `pages/ClientView.jsx` (only "client to reply" emails; "I'll reply myself", "Hand to assistant", "Already done") |
| Conversation details | `Detail` in `Inbox.jsx` (thread, summary, key dates, important / unread / archive / complete) |
| AI summaries & assistance | summaries, date extraction, "Ask AI" panel (`components/AskPanel.jsx`) |
| Reply drafting & review | draft / redraft, edit, mandatory "I've reviewed this" approval before send |
| Responsive UI | desktop sidebar → mobile bottom tabs, list/detail switch on mobile, loading / empty / error / success states |

## What is simulated (and what is real)

- **Real:** auth (JWT + bcrypt), REST API, persistence, classification pipeline, re-classification on new messages, manual overrides, filtering/search, approval gate on replies.
- **Simulated:** Gmail/Outlook OAuth and sync (sample mailboxes in `server/src/seed.js`; "Sync now" and "Simulate new email" inject messages), email sending (adds the reply to the thread only).
- **AI:** a transparent rule-based engine by default (badge shows "Simulated AI"). Put `ANTHROPIC_API_KEY` in `server/.env` and classification, summaries, drafts and Ask AI use the live model automatically, falling back to rules on any error.

## MongoDB later

`server/src/store.js` exposes `insert / get / find / update / removeWhere` over three collections (`users`, `accounts`, `conversations`). Replace that file with Mongoose models of the same shape; routes in `index.js` stay the same (add `await`).

## Layout

```
server/src/  index.js (routes) · ai.js (classify, summarize, draft, ask) · seed.js · store.js
client/src/  pages/ · components/ · styles.css · api.js · auth.jsx
```
