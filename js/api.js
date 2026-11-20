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
// Soft-deleted records are filtered out here rather than with a PB `filter=`
// query, for the same reason the sort is client-side: the list is a handful
// of records, so there's no reason to depend on server-side query syntax.
// Priority is a number: 1 = Haster, 0 = Normal, -1 = Kan vente. Records
// created before the field existed read as 0 (PocketBase numbers default to
// 0), so they all land in Normal without a backfill. Highest priority first,
// newest first within each level.
export const sortTasks = (list) => list.sort((a, b) =>
  (b.priority || 0) - (a.priority || 0) || new Date(b.created) - new Date(a.created));

export async function listTasks() {
  const r = await pbReq('GET', `${BASE}?perPage=500`);
  return sortTasks(r.items.filter(t => !t.deleted));
}

export async function addTask(title, note, priority = 0) {
  return pbReq('POST', BASE, { title, note: note || '', done: false, priority });
}

export async function setTaskPriority(id, priority) {
  return pbReq('PATCH', `${BASE}/${id}`, { priority });
}

export async function setTaskDone(id, done) {
  return pbReq('PATCH', `${BASE}/${id}`, { done });
}

// Delete is soft on purpose: this flips a flag via the (open) update rule
// instead of issuing a DELETE. The collection's delete rule stays
// superuser-only, so nothing reachable from this app -- or from a stranger
// who finds the URL -- can actually destroy a record, and a mis-tap is
// recoverable from the PocketBase admin UI.
export async function deleteTask(id) {
  return pbReq('PATCH', `${BASE}/${id}`, { deleted: true });
}
