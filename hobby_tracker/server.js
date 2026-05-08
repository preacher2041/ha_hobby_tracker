const express  = require('express');
const path     = require('path');
const { DatabaseSync } = require('node:sqlite');

const PORT    = 3737;
const DB_PATH = '/data/hobby.db';

// ── Database setup ─────────────────────────────────────────────────────────────
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS hobbies (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT '❓',
    color       TEXT NOT NULL DEFAULT '#888888',
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

// ── Migrations — add columns to existing installs ──────────────────────────────
(function migrate() {
  const cols = db.prepare("PRAGMA table_info(hobbies)").all().map(c => c.name);
  if (!cols.includes('name'))  db.exec("ALTER TABLE hobbies ADD COLUMN name  TEXT NOT NULL DEFAULT ''");
  if (!cols.includes('icon'))  db.exec("ALTER TABLE hobbies ADD COLUMN icon  TEXT NOT NULL DEFAULT '❓'");
  if (!cols.includes('color')) db.exec("ALTER TABLE hobbies ADD COLUMN color TEXT NOT NULL DEFAULT '#888888'");
})();

// ── Seed default hobbies if empty ──────────────────────────────────────────────
const count = db.prepare('SELECT COUNT(*) as c FROM hobbies').get();
if (count.c === 0) {
  const defaults = [
    {
      id: 'coding', name: 'Side Projects', icon: '💻', color: '#7b6ef6',
      tasks: ['Set up auth flow', 'Wire up the API endpoint', 'Write the login page UI'],
    },
    {
      id: 'dnd', name: 'D&D Prep', icon: '🐉', color: '#60c080',
      tasks: ['Write the tavern encounter', 'Prep NPC motivations', 'Plan session hooks'],
    },
    {
      id: 'warhammer', name: 'Warhammer', icon: '🎨', color: '#e06060',
      tasks: ['Basecoat 5 Guardsmen boots', 'Wash the armour panels', 'Highlight 3 Marines'],
    },
    {
      id: 'homeassist', name: 'Home Assistant', icon: '🏠', color: '#60b8f0',
      tasks: ['Set up energy dashboard', 'Automate morning lights', 'Fix sensor names'],
    },
  ];

  db.exec('BEGIN');
  try {
    const insertHobby = db.prepare(
      'INSERT INTO hobbies (id, name, icon, color, last_done) VALUES (?, ?, ?, ?, 0)'
    );
    const insertTask = db.prepare(
      'INSERT INTO tasks (hobby_id, text, position) VALUES (?, ?, ?)'
    );
    for (const h of defaults) {
      insertHobby.run(h.id, h.name, h.icon, h.color);
      h.tasks.forEach((text, i) => insertTask.run(h.id, text, i));
    }
    db.exec('COMMIT');
    console.log('Seeded default hobbies and tasks');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
} else {
  // Backfill name/icon/color for rows seeded before the migration
  const META = {
    coding:     { name: 'Side Projects',  icon: '💻', color: '#7b6ef6' },
    dnd:        { name: 'D&D Prep',       icon: '🐉', color: '#60c080' },
    warhammer:  { name: 'Warhammer',      icon: '🎨', color: '#e06060' },
    homeassist: { name: 'Home Assistant', icon: '🏠', color: '#60b8f0' },
  };
  const backfill = db.prepare(
    "UPDATE hobbies SET name=?, icon=?, color=? WHERE id=? AND (name='' OR name IS NULL)"
  );
  for (const [id, m] of Object.entries(META)) {
    backfill.run(m.name, m.icon, m.color, id);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getAllData() {
  const hobbies = db.prepare('SELECT * FROM hobbies').all();
  const tasks   = db.prepare('SELECT * FROM tasks ORDER BY position ASC').all();

  return hobbies.map(h => ({
    id:       h.id,
    name:     h.name,
    icon:     h.icon,
    color:    h.color,
    lastDone: h.last_done,
    tasks:    tasks.filter(t => t.hobby_id === h.id).map(t => ({ id: t.id, text: t.text })),
  }));
}

// ── Express app ────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Ingress IP restriction — only allow requests from the Supervisor proxy
app.use((req, res, next) => {
  const ip = req.socket.remoteAddress;
  if (ip !== '172.30.32.2' && ip !== '::ffff:172.30.32.2') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Serve the UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// GET /hobbies
app.get('/hobbies', (req, res) => {
  try { res.json(getAllData()); }
  catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /hobbies — create a new hobby
app.post('/hobbies', (req, res) => {
  try {
    const { id, name, icon, color } = req.body;
    if (!id   || !id.trim())   return res.status(400).json({ error: 'id is required' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

    const safeId    = id.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const safeName  = name.trim();
    const safeIcon  = (icon  || '❓').trim();
    const safeColor = (color || '#888888').trim();

    if (db.prepare('SELECT id FROM hobbies WHERE id = ?').get(safeId)) {
      return res.status(409).json({ error: 'A hobby with that id already exists' });
    }

    db.prepare(
      'INSERT INTO hobbies (id, name, icon, color, last_done) VALUES (?, ?, ?, ?, 0)'
    ).run(safeId, safeName, safeIcon, safeColor);

    res.json({ id: safeId, name: safeName, icon: safeIcon, color: safeColor, lastDone: 0, tasks: [] });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// PATCH /hobbies/:id — update name, icon, color
app.patch('/hobbies/:id', (req, res) => {
  try {
    const hobby = db.prepare('SELECT * FROM hobbies WHERE id = ?').get(req.params.id);
    if (!hobby) return res.status(404).json({ error: 'Hobby not found' });

    const name  = (req.body.name  !== undefined ? req.body.name  : hobby.name).trim();
    const icon  = (req.body.icon  !== undefined ? req.body.icon  : hobby.icon).trim();
    const color = (req.body.color !== undefined ? req.body.color : hobby.color).trim();

    if (!name) return res.status(400).json({ error: 'name cannot be empty' });

    db.prepare('UPDATE hobbies SET name=?, icon=?, color=? WHERE id=?').run(name, icon, color, req.params.id);
    res.json({ ok: true, id: req.params.id, name, icon, color });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// DELETE /hobbies/:id — cascade delete hobby and all its tasks
app.delete('/hobbies/:id', (req, res) => {
  try {
    if (!db.prepare('SELECT id FROM hobbies WHERE id = ?').get(req.params.id)) {
      return res.status(404).json({ error: 'Hobby not found' });
    }
    db.exec('BEGIN');
    db.prepare('DELETE FROM tasks   WHERE hobby_id = ?').run(req.params.id);
    db.prepare('DELETE FROM hobbies WHERE id = ?').run(req.params.id);
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// POST /hobbies/:id/log
app.post('/hobbies/:id/log', (req, res) => {
  try {
    db.prepare('UPDATE hobbies SET last_done = ? WHERE id = ?').run(Date.now(), req.params.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /hobbies/:id/tasks
app.post('/hobbies/:id/tasks', (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
    const maxPos = db.prepare('SELECT MAX(position) as m FROM tasks WHERE hobby_id = ?').get(req.params.id);
    const pos    = (maxPos.m ?? -1) + 1;
    const result = db.prepare(
      'INSERT INTO tasks (hobby_id, text, position) VALUES (?, ?, ?)'
    ).run(req.params.id, text.trim(), pos);
    res.json({ id: result.lastInsertRowid, text: text.trim() });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// PATCH /tasks/:id
app.patch('/tasks/:id', (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
    db.prepare('UPDATE tasks SET text = ? WHERE id = ?').run(text.trim(), req.params.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// DELETE /tasks/:id
app.delete('/tasks/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// POST /hobbies/:id/log-task/:taskId
app.post('/hobbies/:id/log-task/:taskId', (req, res) => {
  try {
    db.exec('BEGIN');
    db.prepare('UPDATE hobbies SET last_done = ? WHERE id = ?').run(Date.now(), req.params.id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.taskId);
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Hobby Tracker running on port ${PORT}`);
});