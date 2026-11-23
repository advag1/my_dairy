const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const USER_SESSION_KEY = 'weekly_planner_current_user';

let currentUser = null;
let notes = [];
let selectedColor = 'yellow';
let draggedNoteId = null;
let isRegisterMode = false;
let weekOffset = 0;

// אלמנטים של התחברות / הרשמה
const authModal = document.getElementById('authModal');
const authTitle = document.getElementById('authTitle');
const authDesc = document.getElementById('authDesc');
const authSubmitBtn = document.getElementById('authSubmitBtn');
const authSwitchText = document.getElementById('authSwitchText');
const toggleAuthModeBtn = document.getElementById('toggleAuthModeBtn');
const loginForm = document.getElementById('loginForm');
const loginUsernameInput = document.getElementById('loginUsername');
const loginPasswordInput = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const userBadge = document.getElementById('userBadge');
const displayUsername = document.getElementById('displayUsername');
const displayUserId = document.getElementById('displayUserId');
const logoutBtn = document.getElementById('logoutBtn');

// אלמנטים מה-DOM
const boardEl = document.getElementById('weeklyBoard');
const backlogZoneEl = document.getElementById('backlogZone');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const weekRangeEl = document.getElementById('weekRange');

// אלמנטים של מודאל הפתק
const modal = document.getElementById('noteModal');
const modalTitle = document.getElementById('modalTitle');
const noteForm = document.getElementById('noteForm');
const noteIdInput = document.getElementById('noteId');
const eventTitleGroup = document.getElementById('eventTitleGroup');
const eventTitleInput = document.getElementById('eventTitleInput');
const dayGroup = document.getElementById('dayGroup');
const noteDayInput = document.getElementById('noteDay');
const periodGroup = document.getElementById('periodGroup');
const notePeriodInput = document.getElementById('notePeriod');
const categoryGroup = document.getElementById('categoryGroup');
const textGroup = document.getElementById('textGroup');
const colorGroup = document.getElementById('colorGroup');
const dueDateLabel = document.getElementById('dueDateLabel');
const noteCategoryInput = document.getElementById('noteCategory');
const noteTextInput = document.getElementById('noteText');
const noteDueDateInput = document.getElementById('noteDueDate');
const noteEstimateInput = document.getElementById('noteEstimate');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');

// --- החלפה בין מצב התחברות למצב הרשמה ---
toggleAuthModeBtn.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  loginError.classList.add('hidden');

  if (isRegisterMode) {
    authTitle.textContent = '✨ יצירת משתמש חדש';
    authDesc.textContent = 'בחרי שם משתמש וסיסמה קבועים שישמשו אותך לכניסה ליומן שלך:';
    authSubmitBtn.textContent = 'צרי משתמש והיכנסי';
    authSwitchText.textContent = 'כבר יש לך משתמש?';
    toggleAuthModeBtn.textContent = 'התחברי כאן';
  } else {
    authTitle.textContent = '🔒 כניסה ליומן השבועי';
    authDesc.textContent = 'הזיני את שם המשתמש והסיסמה שלך:';
    authSubmitBtn.textContent = 'התחברות';
    authSwitchText.textContent = 'עוד אין לך משתמש?';
    toggleAuthModeBtn.textContent = 'הגדירי שם משתמש וסיסמה כאן';
  }
});

// --- ניהול משתמשים והתחברות ---
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
  const password = loginPasswordInput.value;

  if (!username || !password) {
    showLoginError('נא להזין שם משתמש וסיסמה.');
    return;
  }

  const endpoint = isRegisterMode ? '/api/register' : '/api/login';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) {
      showLoginError(data.error || 'אירעה שגיאה');
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

// --- תקשורת מול השרת ---
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

// --- חישוב תאריכי השבוע ---
function getWeekDates() {
  const today = new Date();
  const currentDay = today.getDay();
  const sunday = new Date(today);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(today.getDate() - currentDay + weekOffset * 7);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function toISODateString(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayIndexFromISO(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function formatShortDate(dateObj) {
  return `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
}

document.getElementById('prevWeekBtn').addEventListener('click', () => {
  weekOffset--;
  renderBoard();
});

document.getElementById('nextWeekBtn').addEventListener('click', () => {
  weekOffset++;
  renderBoard();
});

document.getElementById('todayWeekBtn').addEventListener('click', () => {
  weekOffset = 0;
  renderBoard();
});

function renderEmptyBoardStructure() {
  const weekDates = getWeekDates();
  const todayISO = toISODateString(new Date());
  weekRangeEl.textContent = `${formatShortDate(weekDates[0])} - ${formatShortDate(weekDates[6])}`;
  boardEl.innerHTML = '';
  backlogZoneEl.innerHTML = '';

  DAYS.forEach((dayName, dayIndex) => {
    const colDateISO = toISODateString(weekDates[dayIndex]);
    const col = document.createElement('section');
    col.className = `day-column ${colDateISO === todayISO ? 'is-today' : ''}`;
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

// --- רינדור הלוח השבועי ומחסן המשימות ---
function renderBoard() {
  renderEmptyBoardStructure();

  const weekDates = getWeekDates();
  const weekStartISO = toISODateString(weekDates[0]);
  const weekEndISO = toISODateString(weekDates[6]);

  const query = searchInput.value.trim().toLowerCase();
  const selectedCat = categoryFilter.value;

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      !query ||
      note.text.toLowerCase().includes(query) ||
      (note.category && note.category.toLowerCase().includes(query));

    let matchesCategory = true;
    if (selectedCat === 'מבחן') {
      matchesCategory = note.type === 'event' || (note.category && note.category.includes('מבחן'));
    } else if (selectedCat !== 'all') {
      matchesCategory = note.category && note.category.includes(selectedCat);
    }

    return matchesSearch && matchesCategory;
  });

  filteredNotes.sort((a, b) => (b.type === 'event' ? 1 : 0) - (a.type === 'event' ? 1 : 0));

  filteredNotes.forEach((note) => {
    if (Number(note.day) === -1) {
      backlogZoneEl.appendChild(createNoteElement(note));
      return;
    }

    if (note.type === 'event' && note.dueDate) {
      if (note.dueDate < weekStartISO || note.dueDate > weekEndISO) {
        return;
      }
      const exactDay = getDayIndexFromISO(note.dueDate);
      const zone = document.querySelector(
        `.notes-dropzone[data-day="${exactDay}"][data-period="${note.period || 'morning'}"]`
      );
      if (zone) {
        zone.appendChild(createNoteElement(note));
      }
      return;
    }

    const zone = document.querySelector(
      `.notes-dropzone[data-day="${note.day}"][data-period="${note.period}"]`
    );
    if (zone) {
      zone.appendChild(createNoteElement(note));
    }
  });

  if (backlogZoneEl.children.length === 0) {
    backlogZoneEl.innerHTML = `<div class="backlog-empty">אין כרגע משימות ממתינות. לחצי על "+ משימה למחסן" כדי להוסיף רעיונות ומשימות לעתיד.</div>`;
  }

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
  const isEvent = note.type === 'event';
  const card = document.createElement('article');
  card.className = isEvent
    ? `sticky-note event-card ${note.done ? 'done' : ''}`
    : `sticky-note color-${note.color || 'yellow'} ${note.done ? 'done' : ''}`;

  card.draggable = true;
  card.dataset.id = note.id;

  const formattedDue = note.dueDate
    ? note.dueDate.split('-').reverse().slice(0, 2).join('/')
    : '';

  const badgeText = isEvent
    ? '🎯 מועד / מבחן'
    : escapeHTML(note.category || 'כללי');

  card.innerHTML = `
    <div class="note-top">
      <span class="note-category">${badgeText}</span>
      <div class="note-actions">
        <input type="checkbox" class="note-check" ${note.done ? 'checked' : ''} title="סמן כבוצע" />
        <button type="button" class="note-edit-btn" title="ערוך">✎</button>
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
      const targetPeriod = targetDay === -1 ? 'unscheduled' : zone.dataset.period;
      const draggedNote = notes.find((n) => n.id === draggedNoteId);

      const updates = { day: targetDay, period: targetPeriod };

      // רק במבחן/מועד התאריך משתנה בגרירה; במשימה רגילה תאריך היעד (הדדליין) נשמר!
      if (draggedNote && draggedNote.type === 'event' && targetDay !== -1) {
        const weekDates = getWeekDates();
        updates.dueDate = toISODateString(weekDates[targetDay]);
      }

      updateNoteOnServer(draggedNoteId, updates);
    });
  });
}

// --- התאמת הטופס לפי סוג הפריט (משימה vs מבחן/מועד) ---
function updateFormVisibility() {
  const selectedType = document.querySelector('input[name="noteType"]:checked').value;
  const isEvent = selectedType === 'event';
  const isUnscheduled = Number(noteDayInput.value) === -1;

  if (isEvent) {
    eventTitleGroup.classList.remove('hidden');
    eventTitleInput.required = true;

    dayGroup.classList.add('hidden');
    categoryGroup.classList.add('hidden');
    textGroup.classList.add('hidden');
    noteTextInput.required = false;
    colorGroup.classList.add('hidden');

    periodGroup.style.visibility = 'visible';
    dueDateLabel.textContent = 'תאריך המבחן / המועד *';
    noteDueDateInput.required = true;
  } else {
    eventTitleGroup.classList.add('hidden');
    eventTitleInput.required = false;

    dayGroup.classList.remove('hidden');
    categoryGroup.classList.remove('hidden');
    textGroup.classList.remove('hidden');
    noteTextInput.required = true;
    colorGroup.classList.remove('hidden');

    periodGroup.style.visibility = isUnscheduled ? 'hidden' : 'visible';
    dueDateLabel.textContent = 'תאריך יעד (אופציונלי)';
    noteDueDateInput.required = false;
  }
}

document.querySelectorAll('input[name="noteType"]').forEach((radio) => {
  radio.addEventListener('change', updateFormVisibility);
});

noteDayInput.addEventListener('change', updateFormVisibility);

function openNewNoteModal(day = new Date().getDay(), period = 'morning') {
  modalTitle.textContent = day === -1 ? 'הוספת משימה למחסן' : 'הוספת פתק / מועד';
  noteForm.reset();
  noteIdInput.value = '';
  noteDayInput.value = day;
  notePeriodInput.value = period === 'unscheduled' ? 'morning' : period;
  document.querySelector('input[name="noteType"][value="task"]').checked = true;

  selectColor('yellow');
  updateFormVisibility();
  deleteNoteBtn.classList.add('hidden');
  modal.classList.remove('hidden');
  noteTextInput.focus();
}

window.openNewNoteModal = openNewNoteModal;

function openEditNoteModal(note) {
  const isEvent = note.type === 'event';
  modalTitle.textContent = isEvent ? 'עריכת מועד חשוב / מבחן' : 'עריכת פתק';
  noteIdInput.value = note.id;
  noteDayInput.value = note.day;
  notePeriodInput.value = note.period === 'unscheduled' ? 'morning' : note.period;
  document.querySelector(`input[name="noteType"][value="${isEvent ? 'event' : 'task'}"]`).checked = true;

  if (isEvent) {
    eventTitleInput.value = note.text || '';
    noteCategoryInput.value = '';
    noteTextInput.value = '';
  } else {
    eventTitleInput.value = '';
    noteCategoryInput.value = note.category || '';
    noteTextInput.value = note.text || '';
  }

  noteDueDateInput.value = note.dueDate || '';
  noteEstimateInput.value = note.estimate || '';
  selectColor(note.color || 'yellow');
  updateFormVisibility();
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

document.getElementById('openNewNoteBtn').addEventListener('click', () => openNewNoteModal(new Date().getDay(), 'morning'));
document.getElementById('addBacklogBtn').addEventListener('click', () => openNewNoteModal(-1, 'unscheduled'));
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('cancelModalBtn').addEventListener('click', closeModal);

document.querySelectorAll('.color-swatch').forEach((btn) => {
  btn.addEventListener('click', () => selectColor(btn.dataset.color));
});

noteForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = noteIdInput.value;
  const chosenType = document.querySelector('input[name="noteType"]:checked').value;
  const isEvent = chosenType === 'event';
  const dueDateVal = noteDueDateInput.value;

  let finalDay = Number(noteDayInput.value);
  // רק במבחן/מועד היום נקבע אוטומטית מתוך התאריך
  if (isEvent && dueDateVal) {
    finalDay = getDayIndexFromISO(dueDateVal);
  }

  const payload = {
    type: chosenType,
    day: finalDay,
    period: finalDay === -1 ? 'unscheduled' : notePeriodInput.value,
    category: isEvent ? 'מבחן' : noteCategoryInput.value.trim(),
    text: isEvent ? eventTitleInput.value.trim() : noteTextInput.value.trim(),
    color: selectedColor,
    dueDate: dueDateVal,
    estimate: noteEstimateInput.value.trim()
  };

  if (id) {
    await updateNoteOnServer(id, payload);
  } else {
    await createNoteOnServer({ ...payload, done: false });
  }

  if (isEvent && dueDateVal) {
    const [y, m, d] = dueDateVal.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    const targetSunday = new Date(targetDate);
    targetSunday.setDate(targetDate.getDate() - targetDate.getDay());

    const today = new Date();
    const currentSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    const diffWeeks = Math.round((targetSunday - currentSunday) / (7 * 24 * 60 * 60 * 1000));
    weekOffset = diffWeeks;
    renderBoard();
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

initSession();