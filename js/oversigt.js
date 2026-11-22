// Read-only mirror (oversigt.html). Reads the same list as the app and
// refreshes itself; nothing here can write to PocketBase.
import { listTasks } from './api.js';

const REFRESH_MS = 60_000;

const listEl = document.getElementById('task-list');
const doneEl = document.getElementById('done-list');
const toggleBtn = document.getElementById('toggle-done');
const summaryEl = document.getElementById('summary');
const updatedEl = document.getElementById('updated');

const LABELS = { 1: ['1. Prioritet', 'p1'], 2: ['2. Prioritet', 'p2'], 3: ['3. Prioritet', 'p3'], 0: ['Normal', 'normal'] };
const fmtDate = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' });
const fmtTime = new Intl.DateTimeFormat('da-DK', { hour: '2-digit', minute: '2-digit' });

let doneVisible = false;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function cardHtml(t) {
  const [label, cls] = LABELS[t.priority || 0] || LABELS[0];
  const prio = t.done ? '' : ` prio-${cls}`;
  const chip = t.done ? '' : `<span class="prio-chip ${cls} static">${label}</span>`;
  const note = t.note ? `<div class="task-note">${esc(t.note)}</div>` : '';
  const added = `<span class="mirror-date">Tilføjet ${fmtDate.format(new Date(t.created))}</span>`;
  return `
    <div class="task-card${t.done ? ' done' : ''}${prio}">
      ${t.done ? '<div class="mirror-mark checked" aria-hidden="true">✓</div>' : ''}
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        ${note}
        <div class="mirror-meta">${chip}${added}</div>
      </div>
    </div>`;
}

function render(tasks) {
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const prioritised = open.filter(t => t.priority).length;

  summaryEl.textContent = open.length
    ? `${open.length} ${open.length === 1 ? 'opgave' : 'opgaver'} mangler` +
      (prioritised ? `, heraf ${prioritised} prioriteret` : '')
    : 'Alt er klaret 🎉';
  listEl.innerHTML = open.map(cardHtml).join('');

  toggleBtn.classList.toggle('hidden', done.length === 0);
  toggleBtn.textContent = `${doneVisible ? 'Skjul' : 'Vis'} afsluttede opgaver (${done.length})`;
  doneEl.classList.toggle('hidden', !doneVisible);
  doneEl.innerHTML = done.map(cardHtml).join('');

  updatedEl.textContent = `Opdateret kl. ${fmtTime.format(new Date())} · opdaterer selv hvert minut`;
}

let last = [];
async function load() {
  try {
    last = await listTasks();
    render(last);
  } catch (err) {
    updatedEl.textContent = 'Kunne ikke hente listen lige nu. Prøver igen om lidt.';
  }
}

toggleBtn.addEventListener('click', () => { doneVisible = !doneVisible; render(last); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
load();
