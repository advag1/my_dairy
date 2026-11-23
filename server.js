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

// --- API משתמשים ---
app.post('/api/login', (req, res) => {
  const { username, userId } = req.body;
  const db = readDB();
  let user = null;

  if (userId && userId.trim()) {
    user = db.users.find((u) => u.id.toLowerCase() === userId.trim().toLowerCase());
    if (!user) {
      return res.status(404).json({ error: 'מזהה משתמש (ID) לא נמצא במערכת' });
    }
  } else if (username && username.trim()) {
    const cleanName = username.trim();
    user = db.users.find((u) => u.username.toLowerCase() === cleanName.toLowerCase());

    if (!user) {
      let newId = generateUserId();
      while (db.users.some((u) => u.id === newId)) {
        newId = generateUserId();
      }
      user = { id: newId, username: cleanName };
      db.users.push(user);
      writeDB(db);
    }
  } else {
    return res.status(400).json({ error: 'יש להזין שם משתמש או ID' });
  }

  res.json(user);
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

  // day = -1 מייצג משימה שטרם שובצה ליום (מחסן משימות)
  const parsedDay = req.body.day !== undefined ? Number(req.body.day) : 0;

  const newNote = {
    id: Date.now().toString(),
    userId: req.params.userId,
    type: req.body.type === 'event' ? 'event' : 'task',
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