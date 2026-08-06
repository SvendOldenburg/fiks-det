import { listTasks, addTask, setTaskDone } from './api.js';

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

const CHECK_SVG = '<svg viewBox="0 0 24 24"><polyline points="5 13 10 18 19 7"/></svg>';

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function taskCardHtml(task) {
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
    render();
  } catch (err) {
    taskList.innerHTML = '<div class="empty-state">Kunne ikke hente listen. Tjek din forbindelse og prøv igen.</div>';
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
    const btn = e.target.closest('.task-check');
    if (!btn) return;
    const card = btn.closest('.task-card');
    toggleTask(card.dataset.id);
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
