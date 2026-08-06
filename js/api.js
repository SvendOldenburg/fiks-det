import { PB_URL as PB } from './config.js';

// No login, on purpose (Svo's call: the list lives on an unlisted URL rather
// than behind auth). Every request here is anonymous. That only works
// because fiksdet_tasks' list/view/create/update rules are set open -- see
// tools/set_rules.py and the README for why that's deliberate, not a bug.

const COLLECTION = 'fiksdet_tasks';
const BASE = `/api/collections/${COLLECTION}/records`;

async function pbReq(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${PB}${path}`, opts);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `PB ${res.status}`);
  return data;
}

// Anvil's README flags a PocketBase 0.37 quirk on that app's (older)
// collections: `?sort=-created` returns 400. Rather than assume this
// collection is affected, we just don't rely on server-side sort at all --
// fetch and sort client-side on the `created` field every record already
// carries in its JSON body. Simpler, and immune to the issue either way.
export async function listTasks() {
  const r = await pbReq('GET', `${BASE}?perPage=500`);
  return r.items.sort((a, b) => new Date(b.created) - new Date(a.created));
}

export async function addTask(title, note) {
  return pbReq('POST', BASE, { title, note: note || '', done: false });
}

export async function setTaskDone(id, done) {
  return pbReq('PATCH', `${BASE}/${id}`, { done });
}
