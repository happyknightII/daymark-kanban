# Daymark

A lightweight personal kanban board for daily focus. Capture tasks, move them through your day, and make room for one thing at a time.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build` and preview it with `npm run preview`.

## Data

Tasks are saved in this browser's local storage. The sample board is illustrative and can be changed or removed. Clearing site data clears the board; there is no account or cloud sync.

On first load, Daymark adds discovered Mission Control project records, AutoDrive campaign runs, and local project workspaces to the project list. Existing tasks remain in place; the imported projects start with empty swimlanes.

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
