# Online Task Management & Detail View Design

**Date**: 2026-06-26
**Status**: Approved
**Scope**: Backend CRUD API, frontend task management UI, task detail page, admin auth

## Overview

Transform Task Sentinel from a config-file-driven monitor into a fully online-managed system. Users can create, edit, and delete tasks through the web UI, view detailed task history with an uptime timeline, and get integration instructions after creating a task.

## Decisions

### Task Source

**Decision**: Remove `config.yml`, manage all tasks online.

**Rationale**: SQLite database already persists all task state. Config file adds a second source of truth and complicates the mental model. Docker volume mapping (`./data:/app/data`) handles persistence.

### Frontend Routing

**Decision**: Introduce `react-router-dom` with two views:
- `/` — Dashboard (existing, enhanced)
- `/tasks/:id` — Task detail page (new)

**Rationale**: Standard SPA routing enables browser back/forward, shareable links, and sufficient space for detail view content.

### Admin Authentication

**Decision**: Single shared password (`ADMIN_PASSWORD` env var), JWT-based session.

**Mechanism**:
- `POST /api/v1/auth/check` accepts `{"password": "..."}`, returns JWT (24h expiry) on match
- Admin endpoints require `Authorization: Bearer <token>`
- Read-only endpoints (dashboard, task list, logs, uptime) require no auth
- Existing `API_TOKEN` for ping reporting remains unchanged and independent

**Rationale**: Lightweight, no user system needed. Password is per-deployment, shared among admins.

### Add Task UI

**Decision**: "+ Add Task" button in dashboard header → Dialog modal.

**Form fields**: name (required), timeout_hours (default 24), alert_interval_hours (default 4), description (optional). Task ID auto-generated from name via slugify (lowercase, spaces to hyphens).

**Post-creation**: Show integration guide dialog with sample commands.

### Uptime Timeline

**Decision**: Pure CSS grid chart (90 days), no chart library.

**Design**: Each cell = 1 day. Colors: green (all OK), yellow (mixed), red (all failed), gray (no data). Hover shows date and stats.

**Rationale**: Zero dependencies, matches project's lightweight approach, consistent with shadcn style.

## Backend Changes

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/auth/check` | None | Verify password, return JWT |
| `POST` | `/api/v1/tasks` | admin | Create task |
| `PATCH` | `/api/v1/tasks/{id}` | admin | Update task (name, timeout, alert interval, description) |
| `DELETE` | `/api/v1/tasks/{id}` | admin | Delete task and all its ping logs |
| `GET` | `/api/v1/tasks/{id}/uptime` | None | Daily status summary for last N days |
| `GET` | `/api/v1/tasks/{id}/logs` | None | Existing, add `offset` param for pagination |

### Auth Implementation

New file `backend/app/auth.py`:
- `create_token(subject: str) -> str` — generate JWT
- `verify_token(token: str) -> str` — validate and return subject
- `verify_admin(credentials: HTTPAuthorizationCredentials) -> None` — FastAPI dependency

Config additions:
- `ADMIN_PASSWORD: str = "admin"`
- `JWT_SECRET: str = "change-me-in-production"`

### Database Changes

**Model changes**:
- `Task` model: add `description: Optional[str]` column (text, nullable)

**Schema additions** (`backend/app/schemas.py`):

```python
class AuthRequest(BaseModel):
    password: str

class AuthResponse(BaseModel):
    token: str

class CreateTaskRequest(BaseModel):
    name: str  # 1-100 chars
    timeout_hours: float = 24.0
    alert_interval_hours: float = 4.0
    description: Optional[str] = None

class UpdateTaskRequest(BaseModel):
    name: Optional[str] = None
    timeout_hours: Optional[float] = None
    alert_interval_hours: Optional[float] = None
    description: Optional[str] = None

class UptimeDayResponse(BaseModel):
    date: str  # YYYY-MM-DD
    ok_count: int
    fail_count: int
    status: str  # "ok" | "mixed" | "failed" | "none"
```

**Migration**: SQLAlchemy `create_all` handles new column. SQLite `ALTER TABLE ADD COLUMN` is non-destructive.

### Config Removal

- Remove `_load_tasks_from_config()` from `database.py`
- Remove `CONFIG_PATH` from `config.py`
- Remove `pyyaml` from `requirements.txt`
- Add `pyjwt` to `requirements.txt`
- Delete `config.yml`
- Remove `config.yml` volume mount from `docker-compose.yml`

### ID Generation

Server-side slugify for auto-generated task IDs:
- Lowercase
- Replace spaces/special chars with hyphens
- Strip leading/trailing hyphens
- Truncate to 100 chars
- If ID collision, append `-2`, `-3`, etc.

## Frontend Changes

### New Dependencies

- `react-router-dom`

### New shadcn Components

```bash
npx shadcn@latest add dialog input label textarea sonner
```

### File Structure

New files:
- `frontend/src/lib/auth.ts` — token storage and management helpers
- `frontend/src/lib/context.tsx` — `AuthContext` provider
- `frontend/src/pages/Dashboard.tsx` — extracted from current `App.tsx`
- `frontend/src/pages/TaskDetail.tsx` — task detail page
- `frontend/src/components/AddTaskDialog.tsx` — create task form dialog
- `frontend/src/components/IntegrationGuide.tsx` — post-creation integration guide
- `frontend/src/components/UptimeBar.tsx` — 90-day uptime grid
- `frontend/src/components/PingLogList.tsx` — paginated ping log table
- `frontend/src/components/AuthGate.tsx` — password entry dialog
- `frontend/src/components/EditTaskDialog.tsx` — edit task form dialog

Modified files:
- `frontend/src/main.tsx` — wrap with `BrowserRouter` and `AuthProvider`
- `frontend/src/App.tsx` — become router shell with `Routes`
- `frontend/src/lib/api.ts` — add admin API functions
- `frontend/src/lib/types.ts` — add new types

### API Layer Additions (`frontend/src/lib/api.ts`)

```typescript
export async function checkPassword(password: string): Promise<{token: string}>
export async function createTask(data: CreateTaskRequest, token: string): Promise<TaskResponse>
export async function updateTask(id: string, data: UpdateTaskRequest, token: string): Promise<TaskResponse>
export async function deleteTask(id: string, token: string): Promise<void>
export async function fetchTaskUptime(id: string, days?: number): Promise<UptimeDayResponse[]>
export async function fetchTaskLogs(id: string, limit?: number, offset?: number): Promise<PingLogResponse[]>
```

### Auth Flow

1. On first load, check localStorage for `ts_token`
2. If missing/expired, show `AuthGate` dialog (password input)
3. On success, store token in localStorage and context
4. Admin operations read token from context
5. Small lock icon in header toggles admin mode (visual indicator)
6. Token expiry (24h) triggers re-auth prompt

### Dashboard Enhancements

- Header: add "+ Add Task" button (right side)
- `TaskCard`: wrap with `<Link to="/tasks/:id">` to make clickable
- Empty state: update text from "Add tasks to config.yml" to "Click '+ Add Task' to create your first task"

### Task Detail Page (`/tasks/:id`)

Layout (top to bottom):

1. **Header row**: ← Back link, task name (h1), status Badge, edit/delete buttons
2. **Info card**: timeout, alert interval, last ping time, last message, next deadline
3. **Uptime timeline**: 90-day CSS grid (UptimeBar component)
4. **Ping log list**: reverse chronological, paginated (PingLogList component)

### Integration Guide Dialog

Shown automatically after task creation. Three sections with copy buttons:

**Section 1 — curl examples**:
```bash
# Success
curl -X POST {BASE_URL}/api/v1/ping \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"task_id": "{task_id}", "status": "success", "message": "Backup completed"}'

# Failure
curl -X POST {BASE_URL}/api/v1/ping \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"task_id": "{task_id}", "status": "failed", "message": "Error: disk full"}'
```

**Section 2 — Crontab example**:
```bash
0 3 * * * /path/to/backup.sh && curl -s -X POST {BASE_URL}/api/v1/ping -H "Authorization: Bearer {API_TOKEN}" -H "Content-Type: application/json" -d '{"task_id":"{task_id}","status":"success"}'
```

**Section 3 — Shell script template**:
```bash
#!/bin/bash
SENTINEL_URL="{BASE_URL}/api/v1/ping"
SENTINEL_TOKEN="{API_TOKEN}"
TASK_ID="{task_id}"

if your_command; then
  curl -sf -X POST "$SENTINEL_URL" \
    -H "Authorization: Bearer $SENTINEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"task_id\":\"$TASK_ID\",\"status\":\"success\",\"message\":\"OK\"}"
else
  curl -sf -X POST "$SENTINEL_URL" \
    -H "Authorization: Bearer $SENTINEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"task_id\":\"$TASK_ID\",\"status\":\"failed\",\"message\":\"Exit code: $?\"}"
fi
```

Values are dynamically filled with the actual `task_id` and the deployment's base URL (`window.location.origin`). `API_TOKEN` is always shown as placeholder `YOUR_API_TOKEN` since it is a server-side secret — a note reminds the user to replace it with the value configured in their `.env`.

### Uptime Bar Component

Pure CSS implementation:
- Container: flex row, 90 cells
- Each cell: 12×12px, rounded-sm, gap-1
- Colors: `bg-emerald-500` (ok), `bg-amber-500` (mixed), `bg-red-500` (failed), `bg-muted` (no data)
- Tooltip on hover: native `title` attribute with "2026-06-20: 12 OK, 0 failed"

Data source: `GET /api/v1/tasks/{id}/uptime?days=90` returns daily aggregates.

### Ping Log List

- Reverse chronological order
- Each row: status icon (✓/✗), relative time, message (truncated)
- "Load more" button at bottom (offset-based pagination, 20 per page)

## File Change Summary

### Backend
| File | Action |
|------|--------|
| `backend/app/auth.py` | New — JWT helpers and FastAPI dependency |
| `backend/app/api.py` | Modify — add CRUD, auth, uptime endpoints |
| `backend/app/config.py` | Modify — add `ADMIN_PASSWORD`, `JWT_SECRET`; remove `CONFIG_PATH` |
| `backend/app/database.py` | Modify — remove config loading |
| `backend/app/models.py` | Modify — add `description` to Task |
| `backend/app/schemas.py` | Modify — add Auth, Create, Update, Uptime schemas |
| `backend/requirements.txt` | Modify — add `pyjwt`, remove `pyyaml` |

### Root
| File | Action |
|------|--------|
| `config.yml` | Delete |
| `docker-compose.yml` | Modify — remove config.yml volume |
| `.env.example` | Modify — add `ADMIN_PASSWORD`, `JWT_SECRET` |
| `Dockerfile` | Modify — remove pyyaml-related config copy (if any) |

### Frontend
| File | Action |
|------|--------|
| `frontend/package.json` | Modify — add `react-router-dom` |
| `frontend/src/main.tsx` | Modify — BrowserRouter + AuthProvider |
| `frontend/src/App.tsx` | Modify — Routes shell |
| `frontend/src/lib/api.ts` | Modify — add admin API functions |
| `frontend/src/lib/types.ts` | Modify — add new types |
| `frontend/src/lib/auth.ts` | New — token helpers |
| `frontend/src/lib/context.tsx` | New — AuthContext |
| `frontend/src/pages/Dashboard.tsx` | New — extracted from App |
| `frontend/src/pages/TaskDetail.tsx` | New — detail page |
| `frontend/src/components/AddTaskDialog.tsx` | New |
| `frontend/src/components/EditTaskDialog.tsx` | New |
| `frontend/src/components/IntegrationGuide.tsx` | New |
| `frontend/src/components/UptimeBar.tsx` | New |
| `frontend/src/components/PingLogList.tsx` | New |
| `frontend/src/components/AuthGate.tsx` | New |

## Error Handling

- **Duplicate task ID**: return 409 Conflict with message "Task ID already exists"
- **Task not found**: return 404
- **Invalid auth**: return 401 with message "Invalid token"
- **Password mismatch**: return 401 with message "Invalid password"
- **Validation errors**: Pydantic returns 422 with field-level errors
- **Delete with logs**: cascade delete all related PingLog rows

## Testing Considerations

- Auth: verify token generation, validation, expiry
- CRUD: create, read, update, delete lifecycle
- ID generation: slugify edge cases (unicode, special chars, collisions)
- Uptime aggregation: correct daily bucketing across timezone boundaries
- Frontend: token persistence, re-auth on expiry, admin mode toggle
