# Hobby Tracker for Home Assistant

A Home Assistant sidebar add-on that helps you decide what hobby to do tonight.

Shows your hobbies with last-done tracking, a suggestion engine (longest neglected = suggested), and per-hobby task lists to break big projects into bite-sized sessions.

![Hobby Tracker screenshot](screenshot.png)

---

## Installation

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**
2. Click the **⋮** menu (top right) → **Repositories**
3. Add this URL: `https://github.com/preacher2041/ha_hobby_tracker`
4. Click **Add**, then close the dialog
5. Find **Hobby Tracker** in the store and click **Install**
6. Click **Start**

The app appears automatically in your sidebar as **Tonight?** — no card setup, no dashboard editing, no JS files to copy.

---

## Features

- **Suggestion engine** — highlights the hobby you've neglected longest
- **Task lists** — break each hobby into small, completable tasks
- **Session logging** — log a general session or tick off a specific task
- **Staleness indicators** — green/amber/red dots show how long since each hobby
- **Edit panel** — manage hobbies and tasks without leaving the app
  - **Hobbies tab** — add new hobbies with a name, emoji, and colour; rename, recolour, or delete existing ones
  - **Tasks tab** — add, rename, and delete tasks per hobby
- **"Just games tonight"** — guilt-free escape hatch

---

## Managing your hobbies

Hobbies are managed entirely from the **⚙ Edit** panel in the app — no code changes required. Four hobbies are seeded on first run (Side Projects, D&D Prep, Warhammer, Home Assistant) and can be renamed, recoloured, or deleted from the UI.

---

## Data

All data is stored in SQLite at `/data/hobby.db` inside the add-on container. This is persisted by Home Assistant across restarts and updates. It is **not** backed up by HA's built-in backup unless you include add-on data.

---

## Architecture

┌─────────────────────────────────────┐
│  Home Assistant sidebar             │
│  (ingress_panel: true)              │
│              │                      │
│              ▼                      │
│  Express server  :3737              │
│  ├── GET  /          → index.html   │
│  ├── GET  /hobbies                  │
│  ├── POST /hobbies                  │
│  ├── PATCH  /hobbies/:id            │
│  ├── DELETE /hobbies/:id            │
│  ├── POST /hobbies/:id/log          │
│  ├── POST /hobbies/:id/log-task/:id │
│  ├── POST /hobbies/:id/tasks        │
│  ├── PATCH  /tasks/:id              │
│  └── DELETE /tasks/:id              │
│              │                      │
│              ▼                      │
│  SQLite  /data/hobby.db             │
└─────────────────────────────────────┘

The UI is a plain HTML page served by Express. All API calls use relative paths derived from `window.location.pathname` — no hardcoded ingress slugs.

Access is restricted to the Home Assistant Supervisor proxy (172.30.32.2). All other origins receive a 401.

---

## Updating

When a new version is released, Home Assistant will show an update notification in the add-on store. Click **Update** — your data is preserved.

> **Note:** Because all files are baked into the Docker image at build time, every update requires a full reinstall (uninstall → install → start). Your database at `/data/hobby.db` is unaffected.

---

## Troubleshooting

**The sidebar panel shows 401 / blank page after an update**  
Clear all site data for your HA instance in your browser and do a hard reload. This is caused by a stale ingress session cookie, not a code issue.

**`ExperimentalWarning: SQLite` in the add-on logs**  
Harmless. Node's built-in `node:sqlite` module is still flagged as experimental even on Node 24.

---

## Licence

MIT