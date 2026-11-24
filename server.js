const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(express.json());
app.use(express.static(__dirname));

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], notes: [] }, null, 2), 'utf8');
}

function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      users: Array.isArray(data.users) ? data.users : [],
      notes: Array.isArray(data.notes) ? data.notes : []
    };
  } catch {
    return { users: [], notes: [] };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function generateUserId() {
  return 'USR-' + Math.floor(1000 + Math.random() * 9000);
}

// --- API הרשמה ---
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !username.trim() || !password || !password.trim()) {
    return res.status(400).json({ error: 'יש להזין שם משתמש וסיסמה' });
  }

  const cleanName = username.trim();
  const db = readDB();

  const exists = db.users.some((u) => u.username.toLowerCase() === cleanName.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: 'שם המשתמש כבר תפוס, בחרי שם אחר או עברי להתחברות' });
  }

  let newId = generateUserId();
  while (db.users.some((u) => u.id === newId)) {
    newId = generateUserId();
  }

  const newUser = {
    id: newId,
    username: cleanName,
    password: password.trim()
  };

  db.users.push(newUser);
  writeDB(db);

  res.status(201).json({ id: newUser.id, username: newUser.username });
});

// --- API התחברות ---
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !username.trim() || !password) {
    return res.status(400).json({ error: 'יש להזין שם משתמש וסיסמה' });
  }

  const cleanName = username.trim();
  const db = readDB();
  const userIndex = db.users.findIndex(
    (u) => u.username.toLowerCase() === cleanName.toLowerCase()
  );

  if (userIndex === -1) {
    return res.status(404).json({ error: 'שם משתמש לא נמצא. הירשמי תחילה כמשתמשת חדשה.' });
  }

  const user = db.users[userIndex];

  if (!user.password) {
    db.users[userIndex].password = password;
    writeDB(db);
  } else if (user.password !== password) {
    return res.status(401).json({ error: 'סיסמה שגויה' });
  }

  res.json({ id: user.id, username: user.username });
});

// --- API פתקים ומועדים לפי משתמש ---
app.get('/api/users/:userId/notes', (req, res) => {
  const db = readDB();
  const userNotes = db.notes.filter((n) => n.userId === req.params.userId);
  res.json(userNotes);
});

app.post('/api/users/:userId/notes', (req, res) => {
  const db = readDB();
  const userExists = db.users.some((u) => u.id === req.params.userId);
  if (!userExists) {
    return res.status(404).json({ error: 'משתמש לא נמצא' });
  }

  const parsedDay = req.body.day !== undefined ? Number(req.body.day) : 0;

  const newNote = {
    id: Date.now().toString(),
    userId: req.params.userId,
    type: req.body.type === 'event' ? 'event' : 'task',
    weekStart: parsedDay === -1 ? '' : (req.body.weekStart || ''),
    day: parsedDay,
    period: parsedDay === -1 ? 'unscheduled' : (req.body.period === 'evening' ? 'evening' : 'morning'),
    category: req.body.category || '',
    text: req.body.text || '',
    color: req.body.color || 'yellow',
    dueDate: req.body.dueDate || '',
    estimate: req.body.estimate || '',
    done: Boolean(req.body.done)
  };

  db.notes.push(newNote);
  writeDB(db);
  res.status(201).json(newNote);
});

app.put('/api/users/:userId/notes/:noteId', (req, res) => {
  const db = readDB();
  const index = db.notes.findIndex(
    (n) => n.id === req.params.noteId && n.userId === req.params.userId
  );

  if (index === -1) {
    return res.status(404).json({ error: 'פתק לא נמצא' });
  }

  db.notes[index] = {
    ...db.notes[index],
    ...req.body,
    id: req.params.noteId,
    userId: req.params.userId
  };

  writeDB(db);
  res.json(db.notes[index]);
});

app.delete('/api/users/:userId/notes/:noteId', (req, res) => {
  const db = readDB();
  db.notes = db.notes.filter(
    (n) => !(n.id === req.params.noteId && n.userId === req.params.userId)
  );
  writeDB(db);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`השרת פעיל בכתובת: http://localhost:${PORT}`);
});