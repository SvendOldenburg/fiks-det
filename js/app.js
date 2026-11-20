import { listTasks, addTask, setTaskDone, deleteTask, setTaskPriority, sortTasks } from './api.js';

const form = document.getElementById('add-form');
const titleInput = document.getElementById('task-title');
const noteInput = document.getElementById('task-note');
const addBtn = document.getElementById('add-btn');
const addError = document.getElementById('add-error');
const taskList = document.getElementById('task-list');
const doneList = document.getElementById('done-list');
const toggleDoneBtn = document.getElementById('toggle-done');
const addPriority = document.getElementById('add-priority');
const undoBar = document.getElementById('undo-bar');
const undoText = document.getElementById('undo-text');
const undoBtn = document.getElementById('undo-btn');

let tasks = [];
let doneVisible = false;
let confirmingId = null;  // task awaiting "really delete?", one at a time
let prioritizingId = null;  // task with its priority picker open, one at a time
let newPriority = 0;  // what the add form's picker is set to

const PRIORITIES = [
  { value: 1, label: '1. Prioritet', cls: 'p1' },
  { value: 2, label: '2. Prioritet', cls: 'p2' },
  { value: 3, label: '3. Prioritet', cls: 'p3' },
  { value: 0, label: 'Normal', cls: 'normal' },
];
const prioOf = (task) => PRIORITIES.find(p => p.value === (task.priority || 0)) || PRIORITIES[3];

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
  if (task.id === prioritizingId && !task.done) return priorityCardHtml(task);

  const doneClass = task.done ? ' done' : '';
  const prio = prioOf(task);
  const prioClass = task.done ? '' : ` prio-${prio.cls}`;
  // Finished tasks don't need a priority, so the chip only shows on open ones.
  const chip = task.done ? '' :
    `<button class="prio-chip ${prio.cls}" type="button" data-action="ask-priority" aria-label="Prioritet: ${prio.label}. Tryk for at ændre">${prio.label}</button>`;
  const note = task.note ? `<div class="task-note">${escapeHtml(task.note)}</div>` : '';
  const label = task.done ? 'Marker som ikke klar' : 'Marker som klar';
  return `
    <div class="task-card${doneClass}${prioClass}" data-id="${task.id}">
      <button class="task-check" type="button" aria-label="${label}">${CHECK_SVG}</button>
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${note}
        ${chip}
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

// Same pattern as the delete confirm: the card itself turns into the picker,
// so it's obvious which task is being changed.
function priorityCardHtml(task) {
  const current = task.priority || 0;
  const opts = PRIORITIES.map(p => `
    <button type="button" class="prio-opt${p.value === current ? ' selected' : ''}"
      data-action="set-priority" data-prio="${p.value}">${p.label}</button>`).join('');
  return `
    <div class="task-card choosing" data-id="${task.id}">
      <div class="task-body">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="choose-label">Hvor vigtigt er det?</div>
        <div class="prio-picker">${opts}</div>
        <button class="link-btn" type="button" data-action="cancel-priority">Fortryd</button>
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
    prioritizingId = null;
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

async function changePriority(id, priority) {
  const task = tasks.find(t => t.id === id);
  prioritizingId = null;
  if (!task || (task.priority || 0) === priority) return render();
  const prev = task.priority || 0;
  task.priority = priority; // optimistic, reverted below on failure
  sortTasks(tasks);
  render();
  revealCard(id);
  try {
    await setTaskPriority(id, priority);
  } catch (err) {
    task.priority = prev;
    sortTasks(tasks);
    render();
  }
}

// A new priority re-sorts the list, so the task usually jumps somewhere
// off-screen and she's left looking at the wrong part of the list (mom's
// first report: "can't get away from it, can't see the top tasks"). Follow
// the card to its new spot and flash it so it's obvious where it went.
function revealCard(id) {
  const card = taskList.querySelector(`[data-id="${id}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('just-moved');
  setTimeout(() => card.classList.remove('just-moved'), 1600);
}

function setNewPriority(value) {
  newPriority = value;
  for (const btn of addPriority.querySelectorAll('.prio-opt')) {
    const on = Number(btn.dataset.prio) === value;
    btn.classList.toggle('selected', on);
    btn.setAttribute('aria-checked', on);
  }
}

addPriority.addEventListener('click', (e) => {
  const btn = e.target.closest('.prio-opt');
  if (btn) setNewPriority(Number(btn.dataset.prio));
});

// Marking a task done moves it out of sight into the hidden "afsluttede"
// list. Mom tapped three circles by accident and her list looked "locked"
// (the tasks she expected at the top were simply gone). So every finish
// gets a few seconds of "Fortryd" at the bottom of the screen.
let undoTimer = null;
function offerUndo(task) {
  clearTimeout(undoTimer);
  undoText.textContent = `"${task.title}" er klaret`;
  undoBtn.onclick = () => { hideUndo(); toggleTask(task.id, true); };
  undoBar.classList.remove('hidden');
  undoTimer = setTimeout(hideUndo, 7000);
}
function hideUndo() {
  clearTimeout(undoTimer);
  undoBar.classList.add('hidden');
}

async function toggleTask(id, fromUndo = false) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const next = !task.done;
  task.done = next; // optimistic update, reverted below on failure
  render();
  if (next) offerUndo(task);
  else if (fromUndo) revealCard(id);
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
    const created = await addTask(title, noteInput.value.trim(), newPriority);
    tasks.unshift(created);
    sortTasks(tasks);
    titleInput.value = '';
    noteInput.value = '';
    setNewPriority(0);
    confirmingId = null;  // don't leave a stale confirm open behind the new task
    prioritizingId = null;
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
      const a = action.dataset.action;
      if (a === 'ask-delete') { confirmingId = id; prioritizingId = null; }
      else if (a === 'cancel-delete') confirmingId = null;
      else if (a === 'confirm-delete') return removeTask(id);
      else if (a === 'ask-priority') { prioritizingId = id; confirmingId = null; }
      else if (a === 'cancel-priority') prioritizingId = null;
      else if (a === 'set-priority') return changePriority(id, Number(action.dataset.prio));
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
