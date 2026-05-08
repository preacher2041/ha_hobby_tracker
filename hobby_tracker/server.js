const express  = require('express');
const cors     = require('cors');
const Database = require('better-sqlite3');
const path     = require('path');

const PORT    = 3737;
const DB_PATH = '/data/hobby.db';

// ── Database setup ─────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS hobbies (
    id          TEXT PRIMARY KEY,
    last_done   INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    hobby_id    TEXT NOT NULL,
    text        TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (hobby_id) REFERENCES hobbies(id)
  );
`);

// Seed default hobbies if empty
const count = db.prepare('SELECT COUNT(*) as c FROM hobbies').get();
if (count.c === 0) {
  const insertHobby = db.prepare('INSERT INTO hobbies (id, last_done) VALUES (?, 0)');
  const insertTask  = db.prepare('INSERT INTO tasks (hobby_id, text, position) VALUES (?, ?, ?)');

  const defaults = {
    coding:     ['Set up auth flow', 'Wire up the API endpoint', 'Write the login page UI'],
    dnd:        ['Write the tavern encounter', 'Prep NPC motivations', 'Plan session hooks'],
    warhammer:  ['Basecoat 5 Guardsmen boots', 'Wash the armour panels', 'Highlight 3 Marines'],
    homeassist: ['Set up energy dashboard', 'Automate morning lights', 'Fix sensor names'],
  };

  const seedAll = db.transaction(() => {
    for (const [id, tasks] of Object.entries(defaults)) {
      insertHobby.run(id);
      tasks.forEach((text, i) => insertTask.run(id, text, i));
    }
  });
  seedAll();
  console.log('Seeded default hobbies and tasks');
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getAllData() {
  const hobbies = db.prepare('SELECT * FROM hobbies').all();
  const tasks   = db.prepare('SELECT * FROM tasks ORDER BY position ASC').all();

  return hobbies.map(h => ({
    id:       h.id,
    lastDone: h.last_done,
    tasks:    tasks.filter(t => t.hobby_id === h.id).map(t => ({ id: t.id, text: t.text })),
  }));
}

// ── Express app ────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

// Serve the UI — ingress panel loads this at the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// GET /hobbies — all hobbies with tasks and last-done timestamps
app.get('/hobbies', (req, res) => {
  try {
    res.json(getAllData());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /hobbies/:id/log — mark a session as done now
app.post('/hobbies/:id/log', (req, res) => {
  try {
    db.prepare('UPDATE hobbies SET last_done = ? WHERE id = ?').run(Date.now(), req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /hobbies/:id/tasks — add a task
app.post('/hobbies/:id/tasks', (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
    const maxPos = db.prepare('SELECT MAX(position) as m FROM tasks WHERE hobby_id = ?').get(req.params.id);
    const pos    = (maxPos.m ?? -1) + 1;
    const result = db.prepare('INSERT INTO tasks (hobby_id, text, position) VALUES (?, ?, ?)').run(req.params.id, text.trim(), pos);
    res.json({ id: result.lastInsertRowid, text: text.trim() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// PATCH /tasks/:id — update task text
app.patch('/tasks/:id', (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
    db.prepare('UPDATE tasks SET text = ? WHERE id = ?').run(text.trim(), req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /tasks/:id — delete a task
app.delete('/tasks/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /hobbies/:id/log-task/:taskId — log session and delete completed task
app.post('/hobbies/:id/log-task/:taskId', (req, res) => {
  try {
    const logAndDelete = db.transaction(() => {
      db.prepare('UPDATE hobbies SET last_done = ? WHERE id = ?').run(Date.now(), req.params.id);
      db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.taskId);
    });
    logAndDelete();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Hobby Tracker running on port ${PORT}`);
});
