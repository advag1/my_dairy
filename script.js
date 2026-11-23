const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const USER_SESSION_KEY = 'weekly_planner_current_user';

let currentUser = null; // { id, username }
let notes = [];
let selectedColor = 'yellow';
let draggedNoteId = null;

// אלמנטים של התחברות
const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const loginUsernameInput = document.getElementById('loginUsername');
const loginUserIdInput = document.getElementById('loginUserId');
const loginError = document.getElementById('loginError');
const userBadge = document.getElementById('userBadge');
const displayUsername = document.getElementById('displayUsername');
const displayUserId = document.getElementById('displayUserId');
const logoutBtn = document.getElementById('logoutBtn');

// אלמנטים מה-DOM
const boardEl = document.getElementById('weeklyBoard');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const weekRangeEl = document.getElementById('weekRange');

// אלמנטים של מודאל הפתק
const modal = document.getElementById('noteModal');
const modalTitle = document.getElementById('modalTitle');
const noteForm = document.getElementById('noteForm');
const noteIdInput = document.getElementById('noteId');
const noteDayInput = document.getElementById('noteDay');
const notePeriodInput = document.getElementById('notePeriod');
const noteCategoryInput = document.getElementById('noteCategory');
const noteTextInput = document.getElementById('noteText');
const noteDueDateInput = document.getElementById('noteDueDate');
const noteEstimateInput = document.getElementById('noteEstimate');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');

// --- ניהול משתמשים והתחברות מול השרת ---
function initSession() {
  const savedUser = localStorage.getItem(USER_SESSION_KEY);
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    onUserLoggedIn();
  } else {
    renderEmptyBoardStructure();
    authModal.classList.remove('hidden');
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');

  const username = loginUsernameInput.value.trim();
  const userId = loginUserIdInput.value.trim();

  if (!username && !userId) {
    showLoginError('נא להזין שם משתמש או ID.');
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, userId })
    });

    const data = await res.json();
    if (!res.ok) {
      showLoginError(data.error || 'שגיאה בהתחברות');
      return;
    }

    currentUser = data;
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(currentUser));
    loginForm.reset();
    onUserLoggedIn();
  } catch {
    showLoginError('לא ניתן להתחבר לשרת. ודאי שהשרת פועל (node server.js).');
  }
});

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

function onUserLoggedIn() {
  authModal.classList.add('hidden');
  displayUsername.textContent = currentUser.username;
  displayUserId.textContent = currentUser.id;
  userBadge.classList.remove('hidden');
  fetchNotes();
}

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(USER_SESSION_KEY);
  currentUser = null;
  notes = [];
  userBadge.classList.add('hidden');
  renderBoard();
  authModal.classList.remove('hidden');
});

// --- תקשורת פתקים מול השרת ---
async function fetchNotes() {
  if (!currentUser) return;
  try {
    const res = await fetch(`/api/users/${currentUser.id}/notes`);
    if (res.ok) {
      notes = await res.json();
      renderBoard();
    }
  } catch (err) {
    console.error('שגיאה בטעינת פתקים מהשרת:', err);
  }
}

async function createNoteOnServer(noteData) {
  if (!currentUser) return;
  const res = await fetch(`/api/users/${currentUser.id}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(noteData)
  });

  if (res.ok) {
    const created = await res.json();
    notes.push(created);
    renderBoard();
  }
}

async function updateNoteOnServer(noteId, updates) {
  if (!currentUser) return;
  const idx = notes.findIndex((n) => n.id === noteId);
  if (idx === -1) return;

  notes[idx] = { ...notes[idx], ...updates };
  renderBoard();

  await fetch(`/api/users/${currentUser.id}/notes/${noteId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
}

async function deleteNoteOnServer(noteId) {
  if (!currentUser) return;
  notes = notes.filter((n) => n.id !== noteId);
  renderBoard();

  await fetch(`/api/users/${currentUser.id}/notes/${noteId}`, {
    method: 'DELETE'
  });
}

// --- חישוב תאריכי השבוע הנוכחי ---
function getWeekDates() {
  const today = new Date();
  const currentDay = today.getDay();
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - currentDay);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatShortDate(dateObj) {
  return `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
}

function renderEmptyBoardStructure() {
  const weekDates = getWeekDates();
  const todayIndex = new Date().getDay();
  weekRangeEl.textContent = `${formatShortDate(weekDates[0])} - ${formatShortDate(weekDates[6])}`;
  boardEl.innerHTML = '';

  DAYS.forEach((dayName, dayIndex) => {
    const col = document.createElement('section');
    col.className = `day-column ${dayIndex === todayIndex ? 'is-today' : ''}`;
    col.innerHTML = `
      <div class="day-header">
        <span>יום ${dayName}</span>
        <span class="day-date-sub">${formatShortDate(weekDates[dayIndex])}</span>
      </div>
      ${buildPeriodHTML(dayIndex, 'morning', '☀️ בוקר')}
      ${buildPeriodHTML(dayIndex, 'evening', '🌙 ערב')}
    `;
    boardEl.appendChild(col);
  });
}

// --- רינדור הלוח השבועי ---
function renderBoard() {
  renderEmptyBoardStructure();

  const query = searchInput.value.trim().toLowerCase();
  const selectedCat = categoryFilter.value;

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      !query ||
      note.text.toLowerCase().includes(query) ||
      (note.category && note.category.toLowerCase().includes(query));

    const matchesCategory =
      selectedCat === 'all' ||
      (note.category && note.category.includes(selectedCat));

    return matchesSearch && matchesCategory;
  });

  filteredNotes.forEach((note) => {
    const zone = document.querySelector(
      `.notes-dropzone[data-day="${note.day}"][data-period="${note.period}"]`
    );
    if (zone) {
      zone.appendChild(createNoteElement(note));
    }
  });

  setupDragAndDrop();
}

function buildPeriodHTML(dayIndex, period, label) {
  return `
    <div class="period-section ${period}">
      <div class="period-header">
        <span>${label}</span>
        <button type="button" class="add-mini-btn" onclick="openNewNoteModal(${dayIndex}, '${period}')" title="הוסף פתק">+</button>
      </div>
      <div class="notes-dropzone" data-day="${dayIndex}" data-period="${period}"></div>
    </div>
  `;
}

function createNoteElement(note) {
  const card = document.createElement('article');
  card.className = `sticky-note color-${note.color || 'yellow'} ${note.done ? 'done' : ''}`;
  card.draggable = true;
  card.dataset.id = note.id;

  const formattedDue = note.dueDate
    ? note.dueDate.split('-').reverse().slice(0, 2).join('/')
    : '';

  card.innerHTML = `
    <div class="note-top">
      <span class="note-category">${escapeHTML(note.category || 'כללי')}</span>
      <div class="note-actions">
        <input type="checkbox" class="note-check" ${note.done ? 'checked' : ''} title="סמן כבוצע" />
        <button type="button" class="note-edit-btn" title="ערוך פתק">✎</button>
      </div>
    </div>
    <div class="note-body">${escapeHTML(note.text)}</div>
    ${
      formattedDue || note.estimate
        ? `<div class="note-footer">
            ${formattedDue ? `<span class="note-meta-tag">📅 ${formattedDue}</span>` : '<span></span>'}
            ${note.estimate ? `<span class="note-meta-tag">⏱️ ${escapeHTML(note.estimate)}</span>` : ''}
          </div>`
        : ''
    }
  `;

  card.querySelector('.note-check').addEventListener('change', (e) => {
    e.stopPropagation();
    updateNoteOnServer(note.id, { done: e.target.checked });
  });

  card.querySelector('.note-edit-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditNoteModal(note);
  });

  card.addEventListener('dblclick', () => openEditNoteModal(note));

  card.addEventListener('dragstart', () => {
    draggedNoteId = note.id;
    setTimeout(() => (card.style.opacity = '0.5'), 0);
  });

  card.addEventListener('dragend', () => {
    draggedNoteId = null;
    card.style.opacity = '1';
  });

  return card;
}

// --- Drag & Drop ---
function setupDragAndDrop() {
  const dropzones = document.querySelectorAll('.notes-dropzone');

  dropzones.forEach((zone) => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (!draggedNoteId) return;

      const targetDay = Number(zone.dataset.day);
      const targetPeriod = zone.dataset.period;
      updateNoteOnServer(draggedNoteId, { day: targetDay, period: targetPeriod });
    });
  });
}

// --- ניהול מודאל הפתק ---
function openNewNoteModal(day = 0, period = 'morning') {
  modalTitle.textContent = 'פתק משימה חדש';
  noteForm.reset();
  noteIdInput.value = '';
  noteDayInput.value = day;
  notePeriodInput.value = period;
  selectColor('yellow');
  deleteNoteBtn.classList.add('hidden');
  modal.classList.remove('hidden');
  noteTextInput.focus();
}

window.openNewNoteModal = openNewNoteModal;

function openEditNoteModal(note) {
  modalTitle.textContent = 'עריכת פתק';
  noteIdInput.value = note.id;
  noteDayInput.value = note.day;
  notePeriodInput.value = note.period;
  noteCategoryInput.value = note.category || '';
  noteTextInput.value = note.text || '';
  noteDueDateInput.value = note.dueDate || '';
  noteEstimateInput.value = note.estimate || '';
  selectColor(note.color || 'yellow');
  deleteNoteBtn.classList.remove('hidden');
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
}

function selectColor(color) {
  selectedColor = color;
  document.querySelectorAll('.color-swatch').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.color === color);
  });
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.getElementById('openNewNoteBtn').addEventListener('click', () => openNewNoteModal());
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('cancelModalBtn').addEventListener('click', closeModal);

document.querySelectorAll('.color-swatch').forEach((btn) => {
  btn.addEventListener('click', () => selectColor(btn.dataset.color));
});

noteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = noteIdInput.value;
  const payload = {
    day: Number(noteDayInput.value),
    period: notePeriodInput.value,
    category: noteCategoryInput.value.trim(),
    text: noteTextInput.value.trim(),
    color: selectedColor,
    dueDate: noteDueDateInput.value,
    estimate: noteEstimateInput.value.trim()
  };

  if (id) {
    await updateNoteOnServer(id, payload);
  } else {
    await createNoteOnServer({ ...payload, done: false });
  }
  closeModal();
});

deleteNoteBtn.addEventListener('click', async () => {
  const id = noteIdInput.value;
  if (id) {
    await deleteNoteOnServer(id);
    closeModal();
  }
});

searchInput.addEventListener('input', renderBoard);
categoryFilter.addEventListener('change', renderBoard);

// הפעלה ראשונית
initSession();