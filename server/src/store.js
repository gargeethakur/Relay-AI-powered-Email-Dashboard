// Tiny JSON-file document store. Same shape as MongoDB collections so it can be swapped for Mongoose later.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const FILE = process.env.DATA_FILE || path.join(process.cwd(), 'data', 'db.json');
let data = { users: [], accounts: [], conversations: [] };

if (fs.existsSync(FILE)) {
  try { data = { ...data, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) }; } catch { /* start fresh */ }
}

let timer;
function flush() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE + '.tmp', JSON.stringify(data));
  fs.renameSync(FILE + '.tmp', FILE);
}
const save = () => { clearTimeout(timer); timer = setTimeout(flush, 150); };
process.on('exit', () => { try { flush(); } catch {} });
process.on('SIGINT', () => process.exit(0));

export const id = () => crypto.randomUUID().slice(0, 12);

export const db = {
  all: (c) => data[c],
  find: (c, fn) => data[c].filter(fn),
  findOne: (c, fn) => data[c].find(fn),
  get: (c, i) => data[c].find((d) => d.id === i),
  insert(c, doc) { doc.id = doc.id || id(); data[c].push(doc); save(); return doc; },
  update(c, i, patch) {
    const d = data[c].find((x) => x.id === i);
    if (!d) return null;
    Object.assign(d, patch); save(); return d;
  },
  touch: () => save(),
  removeWhere(c, fn) { data[c] = data[c].filter((d) => !fn(d)); save(); },
};
