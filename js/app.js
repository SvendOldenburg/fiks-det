import { listTasks, addTask, setTaskDone, deleteTask } from './api.js';

const form = document.getElementById('add-form');
const titleInput = document.getElementById('task-title');
const noteInput = document.getElementById('task-note');
const addBtn = document.getElementById('add-btn');
const addError = document.getElementById('add-error');
const taskList = document.getElementById('task-list');
const doneList = document.getElementById('done-list');
const toggleDoneBtn = document.getElementById('toggle-done');

let tasks = [];
let doneVisible = false;
let confirmingId = null;  // task awaiting "really delete?", one at a time

const CHECK_SVG = '<svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"/></svg>';
const TRASH_SVG = '<svg viewBox="0 0 24 24"><polyline points="4 7 20 7"/>' +
  '<path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7"/>' +
  '<path d="M6.5 7l.85 12.15A1.5 1.5 0 0 0 8.85 20.5h6.3a1.5 1.5 0 0 0 1.5-1.35L17.5 7"/></svg>';

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function taskCardHtml(task) {
  if (task.id === confirmingId) return confirmCardHtml(task);

  const doneClass = task.done ? ' done' : '';
  const note = task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : '';
  const label = task.done ? 'Marker som ikke klar' : 'Marker som klar';
  return `
    <div class="task-card${doneClass}" data-id="${task.id}">
      <button class="task-check" type="button" aria-label="${label}">${CHECK_SVG}</button>
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${note}
      </div>
      <button class="task-delete" type="button" data-action="ask-delete" aria-label="Slet opgave">${TRASH_SVG}</button>
    </div>
  `;
}

// The card replaces itself with the confirm step rather than opening a dialog,
// so the question sits exactly where the task is and can't be mistaken for a
// question about a different one.
function confirmCardHtml(task) {
  return `
    <div class="task-card confirming" data-id="${task.id}">
      <div class="task-body">
        <div class="task-title">Slet "${escapeHtml(task.title)}"?</div>
        <div class="confirm-actions">
          <button class="btn-cancel" type="button" data-action="cancel-delete">Fortryd</button>
          <button class="btn-confirm" type="button" data-action="confirm-delete">Slet</button>
        </div>
      </div>
    </div>
  `;
}

function render() {
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);

  taskList.innerHTML = open.length
    ? open.map(taskCardHtml).join('')
    : '<div class="empty-state">Ingen opgaver endnu. Tilføj den første ovenfor.</div>';

  toggleDoneBtn.classList.toggle('hidden', done.length === 0);
  toggleDoneBtn.textContent = doneVisible
    ? 'Skjul afsluttede opgaver'
    : `Vis afsluttede opgaver (${done.length})`;

  doneList.classList.toggle('hidden', !doneVisible);
  if (doneVisible) {
    doneList.innerHTML = done.map(taskCardHtml).join('');
  }
}

async function load() {
  taskList.innerHTML = '<div class="empty-state">Henter...</div>';
  try {
    tasks = await listTasks();
    confirmingId = null;
    render();
  } catch (err) {
    taskList.innerHTML = '<div class="empty-state">Kunne ikke hente listen. Tjek din forbindelse og prøv igen.</div>';
  }
}

async function removeTask(id) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  const [removed] = tasks.splice(idx, 1); // optimistic, put back below on failure
  confirmingId = null;
  render();
  try {
    await deleteTask(id);
  } catch (err) {
    tasks.splice(idx, 0, removed);
    render();
  }
}

async function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const next = !task.done;
  task.done = next; // optimistic update, reverted below on failure
  render();
  try {
    await setTaskDone(id, next);
  } catch (err) {
    task.done = !next;
    render();
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  addError.classList.add('hidden');
  addBtn.disabled = true;
  try {
    const created = await addTask(title, noteInput.value.trim());
    tasks.unshift(created);
    titleInput.value = '';
    noteInput.value = '';
    confirmingId = null;  // don't leave a stale confirm open behind the new task
    render();
  } catch (err) {
    addError.textContent = 'Kunne ikke gemme opgaven. Prøv igen.';
    addError.classList.remove('hidden');
  } finally {
    addBtn.disabled = false;
    titleInput.focus();
  }
});

for (const list of [taskList, doneList]) {
  list.addEventListener('click', (e) => {
    const card = e.target.closest('.task-card');
    if (!card) return;
    const id = card.dataset.id;

    const action = e.target.closest('[data-action]');
    if (action) {
      if (action.dataset.action === 'ask-delete') confirmingId = id;
      else if (action.dataset.action === 'cancel-delete') confirmingId = null;
      else if (action.dataset.action === 'confirm-delete') return removeTask(id);
      render();
      return;
    }

    if (e.target.closest('.task-check')) toggleTask(id);
  });
}

toggleDoneBtn.addEventListener('click', () => {
  doneVisible = !doneVisible;
  render();
});

load();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
