# Daymark

A lightweight personal kanban board for daily focus. Capture tasks, move them through your day, and make room for one thing at a time.

## Run locally

```sh
npm install
npm run dev
```

The production app and API run together with `npm start` after `npm run build`.

## Data

Tasks and projects are stored in `~/Projects/daymark-data/state.json`. The browser keeps a local backup and syncs with the API. The API is exposed only through this device's Tailscale Serve HTTPS route; callers need to be on the authorized tailnet.

On first start, the server seeds state from the local-only Codex history, project update, and project catalog files in `public/`, when present.

## API

Base URL on the tailnet: `https://llmhost2.tail72a2a1.ts.net:8443/api/v1`

- `GET /` — API discovery document.
- `GET /state` or `PUT /state` — read or replace all task and project state.
- `GET /tasks` or `POST /tasks` — list tasks or create one. New tasks accept `title`, `project`, `column`, `priority`, `due`, and `milestone`.
- `PATCH /tasks/{id}` or `DELETE /tasks/{id}` — update or remove a task.
- `GET /projects` or `POST /projects` — list projects or create one with `{"name":"Project name"}`.

Task columns are `inbox`, `today`, `doing`, and `done`; priorities are `high`, `normal`, and `low`. All request and response bodies are JSON. This endpoint is private to the tailnet and has no separate application token.

Example:

```sh
curl https://llmhost2.tail72a2a1.ts.net:8443/api/v1/tasks
curl -X POST https://llmhost2.tail72a2a1.ts.net:8443/api/v1/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Check stereo occlusion behavior","project":"Robot Perception","column":"today","priority":"normal"}'
```

## Current scope

- Four daily stages: To sort, Today, In progress, and Done.
- Quick task capture, search, drag-and-drop, and completion.
- A focused view for bringing one task forward.
- Project swimlanes show each project's tasks across the same stages; create projects as needed.
- The roadmap groups dated tasks and milestones by project across the next six months. Drag cards onto a month to reschedule them.
- Responsive layout for desktop and mobile.

Daymark is an early personal project. Cloud sync, collaboration, and user-defined workflow stages are not included yet.

## Kanban implementation

The generic board renderer, swimlane disclosure components, drag handling, and overflow controls in `src/features/kanban/` are adapted from the Mission Control web Kanban implementation. Daymark keeps its own task model, project grouping, roadmap, and local persistence.
