# Hobby Tracker for Home Assistant

A Home Assistant add-on that lives in your sidebar and helps you decide what hobby to do tonight.

Shows your hobbies with last-done tracking, a suggestion engine (longest neglected = suggested), and per-hobby task lists to break big projects into bite-sized sessions.

![Hobby Tracker screenshot](screenshot.png)

---

## Installation

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**
2. Click the **⋮** menu (top right) → **Repositories**
3. Add this URL: `https://github.com/YOUR_USERNAME/hobby-tracker-ha`
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
- **Edit panel** — add, rename, and delete tasks without leaving the app
- **"Just games tonight"** — guilt-free escape hatch

---

## Customising your hobbies

The four default hobbies (Side Projects, D&D Prep, Warhammer, Home Assistant) are defined in `hobby_tracker/index.html` in the `HOBBIES_META` object. To change them you'll also need to update the seed data in `hobby_tracker/server.js`.

A future version will make hobbies configurable from within the UI.

---

## Data

All data is stored in SQLite at `/data/hobby.db` inside the add-on container. This is persisted by Home Assistant across restarts and updates. It is **not** backed up by HA's built-in backup unless you include add-on data.

---

## Architecture

```
┌─────────────────────────────────────┐
│  Home Assistant sidebar             │
│  (ingress_panel: true)              │
│              │                      │
│              ▼                      │
│  Express server  :3737              │
│  ├── GET  /          → index.html   │
│  ├── GET  /hobbies                  │
│  ├── POST /hobbies/:id/log          │
│  ├── POST /hobbies/:id/log-task/:id │
│  ├── POST /hobbies/:id/tasks        │
│  ├── PATCH  /tasks/:id              │
│  └── DELETE /tasks/:id              │
│              │                      │
│              ▼                      │
│  SQLite  /data/hobby.db             │
└─────────────────────────────────────┘
```

The UI is a plain HTML page served by Express. All API calls use relative paths — no hardcoded ingress slugs.

---

## Updating

When a new version is released, Home Assistant will show an update notification in the add-on store. Click **Update** — your data is preserved.

---

## Licence

MIT
