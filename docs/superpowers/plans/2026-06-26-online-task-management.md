# Online Task Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Task Sentinel from a config-file-driven monitor into a fully online-managed system with task CRUD API, admin authentication, a task detail page with 90-day uptime timeline, and post-creation integration guide.

**Architecture:** Backend-first approach. Phase 1 removes config.yml and adds JWT auth + CRUD + uptime API. Phase 2 adds React Router SPA routing, auth context, and all new UI components (AddTaskDialog, TaskDetail, UptimeBar, etc.). Backend uses FastAPI + async SQLAlchemy + SQLite. Frontend uses React 19 + Tailwind v4 + base-ui/shadcn components.

**Tech Stack:** FastAPI, PyJWT, async SQLAlchemy, aiosqlite, React 19, react-router-dom, Tailwind CSS v4, Vite 8, base-ui, shadcn/ui

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `backend/app/auth.py` | JWT token creation, verification, and FastAPI admin dependency |
| `backend/tests/__init__.py` | Test package init |
| `backend/tests/conftest.py` | Shared test fixtures (async client, DB session, auth token) |
| `backend/tests/test_auth.py` | Auth endpoint tests |
| `backend/tests/test_tasks_crud.py` | Task CRUD API tests |
| `backend/tests/test_uptime.py` | Uptime aggregation API tests |
| `frontend/src/lib/auth.ts` | Token storage helpers (localStorage get/set/clear) |
| `frontend/src/lib/context.tsx` | AuthContext React provider |
| `frontend/src/pages/Dashboard.tsx` | Dashboard page (extracted from current App.tsx) |
| `frontend/src/pages/TaskDetail.tsx` | Task detail page with uptime + logs |
| `frontend/src/components/AddTaskDialog.tsx` | Create task modal form |
| `frontend/src/components/EditTaskDialog.tsx` | Edit task modal form |
| `frontend/src/components/IntegrationGuide.tsx` | Post-creation integration guide modal |
| `frontend/src/components/UptimeBar.tsx` | 90-day CSS grid uptime visualization |
| `frontend/src/components/PingLogList.tsx` | Paginated ping log table |
| `frontend/src/components/AuthGate.tsx` | Password entry dialog for admin auth |

### Modified Files
| File | Changes |
|------|---------|
| `backend/app/config.py` | Add `ADMIN_PASSWORD`, `JWT_SECRET`; remove `CONFIG_PATH` |
| `backend/app/models.py` | Add `description` column to Task model |
| `backend/app/schemas.py` | Add `AuthRequest`, `AuthResponse`, `CreateTaskRequest`, `UpdateTaskRequest`, `UptimeDayResponse`; add `description` to `TaskResponse` |
| `backend/app/database.py` | Remove `_load_tasks_from_config()` and yaml import |
| `backend/app/api.py` | Add auth, CRUD, uptime endpoints; add `offset` param to logs |
| `backend/requirements.txt` | Add `pyjwt`; remove `pyyaml` |
| `backend/app/main.py` | Replace single `@app.get("/")` with SPA catch-all for client-side routing |
| `config.yml` | Delete |
| `docker-compose.yml` | Remove `config.yml` volume mount |
| `.env.example` | Add `ADMIN_PASSWORD`, `JWT_SECRET` |
| `backend/.env.example` | Add `ADMIN_PASSWORD`, `JWT_SECRET` |
| `frontend/package.json` | Add `react-router-dom` |
| `frontend/src/main.tsx` | Wrap with `BrowserRouter` and `AuthProvider` |
| `frontend/src/App.tsx` | Become router shell with `Routes` |
| `frontend/src/lib/api.ts` | Add admin API functions (checkPassword, createTask, updateTask, deleteTask, fetchTaskUptime) |
| `frontend/src/lib/types.ts` | Add `UptimeDayResponse`, `CreateTaskRequest`, `UpdateTaskRequest` types; add `description` to `TaskResponse` |
| `frontend/src/components/TaskCard.tsx` | Wrap with `<Link>` for navigation to detail page |

---

## Phase 1: Backend

### Task 1: Test Infrastructure Setup

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Modify: `backend/requirements.txt`

No existing tests or test framework. Set up pytest with async support.

- [ ] **Step 1: Add test dependencies to requirements.txt**

Add to `backend/requirements.txt`:

```
pytest==8.3.4
pytest-asyncio==0.24.0
httpx==0.28.1
```

Note: `httpx` is already present (used by notifier). Keep it.

- [ ] **Step 2: Create `backend/tests/__init__.py`**

Empty file:

```python
```

- [ ] **Step 3: Create `backend/tests/conftest.py`**

```python
import asyncio
import os
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Force test database before any app imports
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./data/test_task_sentinel.db"
os.environ["ADMIN_PASSWORD"] = "test-admin-pass"
os.environ["JWT_SECRET"] = "test-jwt-secret"
os.environ["API_TOKEN"] = "test-api-token"

from app.database import Base
from app.main import app

TEST_DB_URL = "sqlite+aiosqlite:///./data/test_task_sentinel.db"
test_engine = create_async_engine(TEST_DB_URL, echo=False)
test_session_factory = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    # Clean up test DB file
    import pathlib
    db_path = pathlib.Path("./data/test_task_sentinel.db")
    if db_path.exists():
        db_path.unlink()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_token(client: AsyncClient) -> str:
    resp = await client.post(
        "/api/v1/auth/check",
        json={"password": "test-admin-pass"},
    )
    return resp.json()["token"]


@pytest_asyncio.fixture
def auth_headers(admin_token: str) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}
```

- [ ] **Step 4: Create data directory and verify test setup**

Run: `mkdir -p backend/data`

- [ ] **Step 5: Commit**

```bash
git add backend/tests/__init__.py backend/tests/conftest.py backend/requirements.txt
git commit -m "test: add pytest async test infrastructure"
```

---

### Task 2: Backend Config — Add Auth Settings, Remove CONFIG_PATH

**Files:**
- Modify: `backend/app/config.py`
- Modify: `.env.example`
- Modify: `backend/.env.example`

- [ ] **Step 1: Update `backend/app/config.py`**

Replace the entire file:

```python
import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    API_TOKEN: str = "change-me-in-production"
    ADMIN_PASSWORD: str = "admin"
    JWT_SECRET: str = "change-me-in-production"
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/task_sentinel.db"
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    TELEGRAM_PROXY: str = ""
    CHECK_INTERVAL_SECONDS: int = 60
    FRONTEND_DIST: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings(_env_file=os.path.join(os.path.dirname(__file__), "..", ".env"))
```

Changes: Removed `CONFIG_PATH`, added `ADMIN_PASSWORD` and `JWT_SECRET`.

- [ ] **Step 2: Update `.env.example` (project root)**

Replace entire file:

```
API_TOKEN=change-me-in-production
ADMIN_PASSWORD=admin
JWT_SECRET=change-me-in-production
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_PROXY=
CHECK_INTERVAL_SECONDS=60
```

- [ ] **Step 3: Update `backend/.env.example`**

Same content as root `.env.example`:

```
API_TOKEN=change-me-in-production
ADMIN_PASSWORD=admin
JWT_SECRET=change-me-in-production
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_PROXY=
CHECK_INTERVAL_SECONDS=60
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/config.py .env.example backend/.env.example
git commit -m "feat: add ADMIN_PASSWORD and JWT_SECRET config, remove CONFIG_PATH"
```

---

### Task 3: Backend Auth Module

**Files:**
- Create: `backend/app/auth.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add pyjwt to requirements.txt**

In `backend/requirements.txt`, add `pyjwt==2.10.1` and remove `pyyaml==6.0.2`.

The final `backend/requirements.txt`:

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy[asyncio]==2.0.36
aiosqlite==0.20.0
greenlet==3.1.1
apscheduler==3.10.4
httpx==0.28.1
python-dotenv==1.0.1
pydantic==2.10.4
pydantic-settings==2.7.1
pyjwt==2.10.1
pytest==8.3.4
pytest-asyncio==0.24.0
```

- [ ] **Step 2: Create `backend/app/auth.py`**

```python
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings

ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 24

admin_security = HTTPBearer(auto_error=False)


def create_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    payload = {
        "sub": subject,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def verify_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        subject: str = payload.get("sub")
        if subject is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return subject
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def verify_admin(
    credentials: HTTPAuthorizationCredentials = Depends(admin_security),
) -> None:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    verify_token(credentials.credentials)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/auth.py backend/requirements.txt
git commit -m "feat: add JWT auth module with admin dependency"
```

---

### Task 4: Backend Schemas — Add Auth, CRUD, Uptime Schemas

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: Update `backend/app/schemas.py`**

Replace the entire file:

```python
from typing import List, Optional

from pydantic import BaseModel, Field


class PingRequest(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = None


class TaskResponse(BaseModel):
    id: str
    name: str
    timeout_hours: float
    alert_interval_hours: float
    description: Optional[str] = None
    status: str
    last_ping_at: Optional[str] = None
    last_ping_message: Optional[str] = None
    last_alert_at: Optional[str] = None
    is_alert_active: bool
    next_deadline: Optional[str] = None


class DashboardResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int
    ok_count: int
    failing_count: int
    offline_count: int


class PingLogResponse(BaseModel):
    id: int
    task_id: str
    status: str
    message: Optional[str] = None
    created_at: str


class AuthRequest(BaseModel):
    password: str


class AuthResponse(BaseModel):
    token: str


class CreateTaskRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    timeout_hours: float = 24.0
    alert_interval_hours: float = 4.0
    description: Optional[str] = None


class UpdateTaskRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    timeout_hours: Optional[float] = None
    alert_interval_hours: Optional[float] = None
    description: Optional[str] = None


class UptimeDayResponse(BaseModel):
    date: str
    ok_count: int
    fail_count: int
    status: str
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat: add auth, CRUD, and uptime Pydantic schemas"
```

---

### Task 5: Backend Model — Add Description Column

**Files:**
- Modify: `backend/app/models.py`

- [ ] **Step 1: Add `description` column to Task model and update `to_dict`**

In `backend/app/models.py`, add the `description` column after `alert_interval_hours`:

```python
    description: Mapped[Optional[str]] = mapped_column(
        String(1024), nullable=True, default=None
    )
```

Update `to_dict()` to include `description`. Replace the `to_dict` method:

```python
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "timeout_hours": self.timeout_hours,
            "alert_interval_hours": self.alert_interval_hours,
            "description": self.description,
            "status": self.status,
            "last_ping_at": self.last_ping_at.isoformat()
            if self.last_ping_at
            else None,
            "last_ping_message": self.last_ping_message,
            "last_alert_at": self.last_alert_at.isoformat()
            if self.last_alert_at
            else None,
            "is_alert_active": self.is_alert_active,
            "next_deadline": self._next_deadline(),
        }
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: add description column to Task model"
```

---

### Task 6: Backend Database — Remove Config Loading

**Files:**
- Modify: `backend/app/database.py`

- [ ] **Step 1: Replace `backend/app/database.py`**

Replace the entire file:

```python
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from .config import settings
from .models import Base

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

Removed: `yaml` import, `Path` import, `select` import, `Task` import, `_load_tasks_from_config()` function, and the call to it in `init_db()`.

- [ ] **Step 2: Delete `config.yml`**

```bash
git rm config.yml
```

- [ ] **Step 3: Update `docker-compose.yml`**

Remove the `./config.yml:/app/config.yml:ro` volume line. Replace `docker-compose.yml`:

```yaml
services:
  app:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    restart: unless-stopped
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/database.py docker-compose.yml
git rm config.yml
git commit -m "refactor: remove config.yml loading, use online task management"
```

---

### Task 7: Backend Auth Endpoint + Tests

**Files:**
- Modify: `backend/app/api.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Write failing test in `backend/tests/test_auth.py`**

```python
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_check_success(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/check",
        json={"password": "test-admin-pass"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert isinstance(data["token"], str)


@pytest.mark.asyncio
async def test_auth_check_wrong_password(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/check",
        json={"password": "wrong-password"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid password"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_auth.py -v`
Expected: FAIL with 404 (endpoint doesn't exist yet)

- [ ] **Step 3: Add auth endpoint to `backend/app/api.py`**

Add imports at the top of `backend/app/api.py`:

```python
from .auth import create_token, verify_admin
from .schemas import AuthRequest, AuthResponse
```

Add the auth endpoint right after the `security = HTTPBearer()` line:

```python
@router.post("/auth/check", response_model=AuthResponse)
async def auth_check(body: AuthRequest):
    if body.password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    token = create_token("admin")
    return AuthResponse(token=token)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_auth.py -v`
Expected: PASS (both tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api.py backend/tests/test_auth.py
git commit -m "feat: add POST /auth/check endpoint for admin login"
```

---

### Task 8: Backend CRUD Endpoints + Tests

**Files:**
- Modify: `backend/app/api.py`
- Create: `backend/tests/test_tasks_crud.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_tasks_crud.py`**

```python
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Task, PingLog


@pytest.mark.asyncio
async def test_create_task(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/tasks",
        json={
            "name": "My Backup Task",
            "timeout_hours": 12.0,
            "alert_interval_hours": 2.0,
            "description": "Daily backup check",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Backup Task"
    assert data["id"] == "my-backup-task"
    assert data["timeout_hours"] == 12.0
    assert data["alert_interval_hours"] == 2.0
    assert data["description"] == "Daily backup check"
    assert data["status"] == "offline"


@pytest.mark.asyncio
async def test_create_task_duplicate(client: AsyncClient, auth_headers: dict):
    payload = {"name": "Dup Task", "timeout_hours": 24.0, "alert_interval_hours": 4.0}
    await client.post("/api/v1/tasks", json=payload, headers=auth_headers)
    resp = await client.post("/api/v1/tasks", json=payload, headers=auth_headers)
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_create_task_no_auth(client: AsyncClient):
    resp = await client.post(
        "/api/v1/tasks",
        json={"name": "No Auth", "timeout_hours": 24.0, "alert_interval_hours": 4.0},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_task(client: AsyncClient, auth_headers: dict):
    await client.post(
        "/api/v1/tasks",
        json={"name": "Update Me", "timeout_hours": 24.0, "alert_interval_hours": 4.0},
        headers=auth_headers,
    )
    resp = await client.patch(
        "/api/v1/tasks/update-me",
        json={"name": "Updated Name", "timeout_hours": 48.0},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Name"
    assert data["timeout_hours"] == 48.0
    assert data["alert_interval_hours"] == 4.0


@pytest.mark.asyncio
async def test_update_task_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.patch(
        "/api/v1/tasks/nonexistent",
        json={"name": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_task(client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
    await client.post(
        "/api/v1/tasks",
        json={"name": "Delete Me", "timeout_hours": 24.0, "alert_interval_hours": 4.0},
        headers=auth_headers,
    )
    # Add a ping log to verify cascade
    from datetime import datetime, timezone
    log = PingLog(task_id="delete-me", status="success", message="test", created_at=datetime.now(timezone.utc))
    db_session.add(log)
    await db_session.commit()

    resp = await client.delete("/api/v1/tasks/delete-me", headers=auth_headers)
    assert resp.status_code == 204

    # Verify task gone
    result = await db_session.execute(select(Task).where(Task.id == "delete-me"))
    assert result.scalar_one_or_none() is None

    # Verify logs cascade deleted
    logs_result = await db_session.execute(select(PingLog).where(PingLog.task_id == "delete-me"))
    assert len(logs_result.scalars().all()) == 0


@pytest.mark.asyncio
async def test_delete_task_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.delete("/api/v1/tasks/nonexistent", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_task_logs_with_offset(client: AsyncClient, db_session: AsyncSession):
    from datetime import datetime, timezone, timedelta
    # Create task
    task = Task(id="log-task", name="Log Task", timeout_hours=24.0, alert_interval_hours=4.0, status="ok")
    db_session.add(task)
    await db_session.commit()

    # Add 5 logs
    now = datetime.now(timezone.utc)
    for i in range(5):
        log = PingLog(task_id="log-task", status="success", message=f"msg-{i}", created_at=now - timedelta(minutes=i))
        db_session.add(log)
    await db_session.commit()

    # Fetch with offset
    resp = await client.get("/api/v1/tasks/log-task/logs?limit=2&offset=2")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert data[0]["message"] == "msg-2"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_tasks_crud.py -v`
Expected: FAIL (endpoints don't exist yet)

- [ ] **Step 3: Implement CRUD endpoints in `backend/app/api.py`**

Add these imports to `backend/app/api.py`:

```python
import re

from sqlalchemy import delete, func
```

Add these schema imports:

```python
from .schemas import (
    AuthRequest,
    AuthResponse,
    CreateTaskRequest,
    DashboardResponse,
    PingLogResponse,
    PingRequest,
    TaskResponse,
    UpdateTaskRequest,
    UptimeDayResponse,
)
```

Add a helper function for slugify after the `verify_token` function:

```python
def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s]+", "-", text)
    text = re.sub(r"-+", "-", text)
    text = text.strip("-")
    return text[:100]
```

Add CRUD endpoints at the end of `backend/app/api.py` (before any closing code, after existing endpoints):

```python
@router.post("/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    body: CreateTaskRequest,
    _: None = Depends(verify_admin),
):
    task_id = _slugify(body.name)
    async with async_session() as session:
        result = await session.execute(select(Task).where(Task.id == task_id))
        if result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Task ID already exists")

        task = Task(
            id=task_id,
            name=body.name,
            timeout_hours=body.timeout_hours,
            alert_interval_hours=body.alert_interval_hours,
            description=body.description,
            status="offline",
        )
        session.add(task)
        await session.commit()
        await session.refresh(task)
        return TaskResponse(**task.to_dict())


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    body: UpdateTaskRequest,
    _: None = Depends(verify_admin),
):
    async with async_session() as session:
        result = await session.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")

        update_data = body.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(task, field, value)

        await session.commit()
        await session.refresh(task)
        return TaskResponse(**task.to_dict())


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    _: None = Depends(verify_admin),
):
    async with async_session() as session:
        result = await session.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")

        # Delete related ping logs first
        await session.execute(delete(PingLog).where(PingLog.task_id == task_id))
        await session.delete(task)
        await session.commit()
```

- [ ] **Step 4: Add `offset` parameter to existing logs endpoint**

Update the existing `get_task_logs` endpoint signature and query:

```python
@router.get("/tasks/{task_id}/logs", response_model=list[PingLogResponse])
async def get_task_logs(task_id: str, limit: int = 50, offset: int = 0):
    async with async_session() as session:
        result = await session.execute(
            select(PingLog)
            .where(PingLog.task_id == task_id)
            .order_by(desc(PingLog.created_at))
            .offset(offset)
            .limit(limit)
        )
        logs = result.scalars().all()
        return [
            PingLogResponse(
                id=l.id,
                task_id=l.task_id,
                status=l.status,
                message=l.message,
                created_at=l.created_at.isoformat() if l.created_at else None,
            )
            for l in logs
        ]
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_tasks_crud.py -v`
Expected: PASS (all tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/api.py backend/tests/test_tasks_crud.py
git commit -m "feat: add task CRUD endpoints and offset pagination for logs"
```

---

### Task 9: Backend Uptime Endpoint + Tests

**Files:**
- Modify: `backend/app/api.py`
- Create: `backend/tests/test_uptime.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_uptime.py`**

```python
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Task, PingLog
from datetime import datetime, timedelta, timezone


@pytest.mark.asyncio
async def test_uptime_empty(client: AsyncClient, db_session: AsyncSession):
    task = Task(id="uptime-empty", name="Empty", timeout_hours=24.0, alert_interval_hours=4.0, status="offline")
    db_session.add(task)
    await db_session.commit()

    resp = await client.get("/api/v1/tasks/uptime-empty/uptime?days=7")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 7
    for day in data:
        assert day["status"] == "none"
        assert day["ok_count"] == 0
        assert day["fail_count"] == 0


@pytest.mark.asyncio
async def test_uptime_with_data(client: AsyncClient, db_session: AsyncSession):
    task = Task(id="uptime-data", name="Data", timeout_hours=24.0, alert_interval_hours=4.0, status="ok")
    db_session.add(task)
    await db_session.commit()

    now = datetime.now(timezone.utc)
    today = now.date()

    # Add 3 OK logs today
    for i in range(3):
        log = PingLog(task_id="uptime-data", status="success", message="ok", created_at=now - timedelta(hours=i))
        db_session.add(log)

    # Add 1 OK + 1 fail yesterday
    yesterday = now - timedelta(days=1)
    db_session.add(PingLog(task_id="uptime-data", status="success", message="ok", created_at=yesterday))
    db_session.add(PingLog(task_id="uptime-data", status="failed", message="err", created_at=yesterday))

    # Add 2 fail logs 3 days ago
    three_days_ago = now - timedelta(days=3)
    db_session.add(PingLog(task_id="uptime-data", status="failed", message="err1", created_at=three_days_ago))
    db_session.add(PingLog(task_id="uptime-data", status="failed", message="err2", created_at=three_days_ago))

    await db_session.commit()

    resp = await client.get("/api/v1/tasks/uptime-data/uptime?days=7")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 7

    # data[0] = today
    assert data[0]["status"] == "ok"
    assert data[0]["ok_count"] == 3
    assert data[0]["fail_count"] == 0

    # data[1] = yesterday
    assert data[1]["status"] == "mixed"
    assert data[1]["ok_count"] == 1
    assert data[1]["fail_count"] == 1

    # data[3] = 3 days ago
    assert data[3]["status"] == "failed"
    assert data[3]["ok_count"] == 0
    assert data[3]["fail_count"] == 2


@pytest.mark.asyncio
async def test_uptime_task_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/tasks/nonexistent/uptime?days=7")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_uptime.py -v`
Expected: FAIL (404 endpoint not found)

- [ ] **Step 3: Implement uptime endpoint in `backend/app/api.py`**

Add import:

```python
from datetime import date
```

Add the uptime endpoint after the delete endpoint:

```python
@router.get("/tasks/{task_id}/uptime", response_model=list[UptimeDayResponse])
async def get_task_uptime(task_id: str, days: int = 90):
    async with async_session() as session:
        result = await session.execute(select(Task).where(Task.id == task_id))
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Task not found")

        now = datetime.now(timezone.utc)
        start_date = now.date() - timedelta(days=days - 1)

        # Fetch all logs for this task in the date range
        start_datetime = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
        result = await session.execute(
            select(PingLog)
            .where(PingLog.task_id == task_id)
            .where(PingLog.created_at >= start_datetime)
        )
        logs = result.scalars().all()

        # Bucket by date
        buckets: dict[date, dict[str, int]] = {}
        for log in logs:
            log_date = log.created_at.date()
            if log_date not in buckets:
                buckets[log_date] = {"ok": 0, "fail": 0}
            if log.status == "success":
                buckets[log_date]["ok"] += 1
            elif log.status == "failed":
                buckets[log_date]["fail"] += 1

        # Build response for each day
        response = []
        for i in range(days):
            day = start_date + timedelta(days=i)
            counts = buckets.get(day, {"ok": 0, "fail": 0})
            ok_count = counts["ok"]
            fail_count = counts["fail"]

            if ok_count == 0 and fail_count == 0:
                status = "none"
            elif fail_count == 0:
                status = "ok"
            elif ok_count == 0:
                status = "failed"
            else:
                status = "mixed"

            response.append(
                UptimeDayResponse(
                    date=day.isoformat(),
                    ok_count=ok_count,
                    fail_count=fail_count,
                    status=status,
                )
            )

        return response
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_uptime.py -v`
Expected: PASS

- [ ] **Step 5: Run all backend tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api.py backend/tests/test_uptime.py
git commit -m "feat: add GET /tasks/{id}/uptime endpoint with daily aggregation"
```

---

### Task 10: Backend SPA Routing Fix

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Update catch-all route for React Router SPA**

The current `@app.get("/")` only matches root. Replace it with a catch-all that serves `index.html` for all non-API, non-file routes so React Router client-side routing works.

In `backend/app/main.py`, replace the static file serving block at the end:

```python
frontend_dist = settings.FRONTEND_DIST or os.path.join(
    os.path.dirname(__file__), "..", "..", "frontend", "dist"
)
if os.path.isdir(frontend_dist):
    import re
    from fastapi.responses import FileResponse
    from starlette.requests import Request

    index_path = os.path.join(frontend_dist, "index.html")

    @app.middleware("http")
    async def spa_fallback(request: Request, call_next):
        response = await call_next(request)
        if response.status_code == 404:
            path = request.url.path
            # Don't intercept API or file requests
            if not path.startswith("/api/") and "." not in path.split("/")[-1]:
                return FileResponse(index_path)
        return response

    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add SPA fallback middleware for React Router client-side routing"
```

---

## Phase 2: Frontend Foundation

### Task 11: Frontend Dependencies + Types + API Layer

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add `react-router-dom` to package.json**

In `frontend/package.json`, add to `dependencies`:

```json
    "react-router-dom": "^7.6.2",
```

Run: `cd frontend && npm install`

- [ ] **Step 2: Update `frontend/src/lib/types.ts`**

Replace the entire file:

```ts
export interface TaskResponse {
  id: string
  name: string
  timeout_hours: number
  alert_interval_hours: number
  description: string | null
  status: "ok" | "offline" | "failing"
  last_ping_at: string | null
  last_ping_message: string | null
  last_alert_at: string | null
  is_alert_active: boolean
  next_deadline: string | null
}

export interface DashboardResponse {
  tasks: TaskResponse[]
  total: number
  ok_count: number
  failing_count: number
  offline_count: number
}

export interface PingLogResponse {
  id: number
  task_id: string
  status: string
  message: string | null
  created_at: string
}

export interface UptimeDayResponse {
  date: string
  ok_count: number
  fail_count: number
  status: "ok" | "mixed" | "failed" | "none"
}

export interface CreateTaskRequest {
  name: string
  timeout_hours?: number
  alert_interval_hours?: number
  description?: string
}

export interface UpdateTaskRequest {
  name?: string
  timeout_hours?: number
  alert_interval_hours?: number
  description?: string
}
```

- [ ] **Step 3: Update `frontend/src/lib/api.ts`**

Replace the entire file:

```ts
import type {
  DashboardResponse,
  PingLogResponse,
  TaskResponse,
  UptimeDayResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "./types"

const API_BASE = "/api/v1"

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!resp.ok) {
    const body = await resp.json().catch(() => null)
    throw new Error(body?.detail || `Request failed: ${resp.status}`)
  }
  if (resp.status === 204) return undefined as T
  return resp.json()
}

function adminHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

// Public endpoints
export async function fetchDashboard(): Promise<DashboardResponse> {
  return request<DashboardResponse>("/dashboard")
}

export async function fetchTask(taskId: string): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${encodeURIComponent(taskId)}`)
}

export async function fetchTaskLogs(
  taskId: string,
  limit = 20,
  offset = 0,
): Promise<PingLogResponse[]> {
  return request<PingLogResponse[]>(
    `/tasks/${encodeURIComponent(taskId)}/logs?limit=${limit}&offset=${offset}`,
  )
}

export async function fetchTaskUptime(
  taskId: string,
  days = 90,
): Promise<UptimeDayResponse[]> {
  return request<UptimeDayResponse[]>(
    `/tasks/${encodeURIComponent(taskId)}/uptime?days=${days}`,
  )
}

// Auth endpoint
export async function checkPassword(password: string): Promise<{ token: string }> {
  return request<{ token: string }>("/auth/check", {
    method: "POST",
    body: JSON.stringify({ password }),
  })
}

// Admin endpoints
export async function createTask(
  data: CreateTaskRequest,
  token: string,
): Promise<TaskResponse> {
  return request<TaskResponse>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json", ...adminHeaders(token) },
  })
}

export async function updateTask(
  id: string,
  data: UpdateTaskRequest,
  token: string,
): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json", ...adminHeaders(token) },
  })
}

export async function deleteTask(id: string, token: string): Promise<void> {
  return request<void>(`/tasks/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: adminHeaders(token),
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: add react-router-dom, new types, and admin API functions"
```

---

### Task 12: Frontend Auth — Token Helpers + AuthContext + AuthGate

**Files:**
- Create: `frontend/src/lib/auth.ts`
- Create: `frontend/src/lib/context.tsx`
- Create: `frontend/src/components/AuthGate.tsx`

- [ ] **Step 1: Create `frontend/src/lib/auth.ts`**

```ts
const TOKEN_KEY = "ts_token"

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    const exp = payload.exp * 1000
    return Date.now() >= exp
  } catch {
    return true
  }
}

export function getValidToken(): string | null {
  const token = getStoredToken()
  if (!token) return null
  if (isTokenExpired(token)) {
    clearToken()
    return null
  }
  return token
}
```

- [ ] **Step 2: Create `frontend/src/lib/context.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { getValidToken, storeToken, clearToken } from "./auth"
import { checkPassword } from "./api"

interface AuthContextType {
  isAdmin: boolean
  token: string | null
  login: (password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  token: null,
  login: async () => false,
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getValidToken())

  useEffect(() => {
    if (token) storeToken(token)
  }, [token])

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const resp = await checkPassword(password)
      setToken(resp.token)
      return true
    } catch {
      return false
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider value={{ isAdmin: token !== null, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 3: Install shadcn dialog and input components**

Run: `cd frontend && npx shadcn@latest add dialog input label textarea sonner -y`

If the command above fails due to the project using `@base-ui/react` instead of `@radix-ui`, create the components manually.

Create `frontend/src/components/ui/dialog.tsx`:

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange?.(false)} />
      <div className="relative z-50 w-full max-w-md rounded-xl bg-background p-6 shadow-lg ring-1 ring-foreground/10">
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2 mb-4", className)} {...props} />
}

export function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />
}

export function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex justify-end gap-2 mt-4", className)} {...props} />
}
```

Create `frontend/src/components/ui/input.tsx`:

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
```

Create `frontend/src/components/ui/label.tsx`:

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  )
}

export { Label }
```

Create `frontend/src/components/ui/textarea.tsx`:

```tsx
import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
```

- [ ] **Step 4: Create `frontend/src/components/AuthGate.tsx`**

```tsx
import { useState } from "react"
import { useAuth } from "@/lib/context"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AuthGate() {
  const { login } = useAuth()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const success = await login(password)
    if (!success) {
      setError("Invalid password")
    }
    setLoading(false)
  }

  return (
    <Dialog open>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Admin Access</DialogTitle>
          <DialogDescription>
            Enter the admin password to manage tasks.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading || !password}>
            {loading ? "Verifying..." : "Unlock"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/auth.ts frontend/src/lib/context.tsx frontend/src/components/AuthGate.tsx frontend/src/components/ui/dialog.tsx frontend/src/components/ui/input.tsx frontend/src/components/ui/label.tsx frontend/src/components/ui/textarea.tsx
git commit -m "feat: add auth token helpers, AuthContext, and AuthGate dialog"
```

---

### Task 13: Frontend Routing — BrowserRouter, App Shell, Dashboard Extraction

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Update `frontend/src/main.tsx`**

Replace the entire file:

```tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from "./lib/context"
import "./index.css"
import App from "./App.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 2: Create `frontend/src/pages/Dashboard.tsx`**

Extract the current `App.tsx` content into Dashboard, with enhancements:

```tsx
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type { DashboardResponse } from "@/lib/types"
import { fetchDashboard } from "@/lib/api"
import { useAuth } from "@/lib/context"
import { StatsBar } from "@/components/StatsBar"
import { TaskCard } from "@/components/TaskCard"
import { AddTaskDialog } from "@/components/AddTaskDialog"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

const REFRESH_INTERVAL = 15_000

export default function Dashboard() {
  const { isAdmin, logout } = useAuth()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await fetchDashboard()
      setData(d)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">Failed to load: {error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Task Sentinel</h1>
          <p className="text-sm text-muted-foreground">
            Task monitoring dashboard
            {lastUpdated && (
              <span className="ml-2">
                &middot; Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button onClick={() => setShowAdd(true)}>+ Add Task</Button>
              <Button variant="ghost" size="sm" onClick={logout}>Lock</Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      <StatsBar data={data} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.tasks.map((task) => (
          <Link key={task.id} to={`/tasks/${task.id}`}>
            <TaskCard task={task} />
          </Link>
        ))}
      </div>

      {data.tasks.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          {isAdmin
            ? "Click '+ Add Task' to create your first task"
            : "No tasks configured."}
        </div>
      )}

      {showAdd && <AddTaskDialog open={showAdd} onOpenChange={setShowAdd} onCreated={load} />}
    </div>
  )
}
```

- [ ] **Step 3: Update `frontend/src/App.tsx`**

Replace the entire file to become a router shell:

```tsx
import { Routes, Route } from "react-router-dom"
import { useAuth } from "@/lib/context"
import { AuthGate } from "@/components/AuthGate"
import Dashboard from "@/pages/Dashboard"
import TaskDetail from "@/pages/TaskDetail"

export default function App() {
  const { isAdmin } = useAuth()

  return (
    <>
      {!isAdmin && <AuthGate />}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
      </Routes>
    </>
  )
}
```

- [ ] **Step 4: Update `frontend/src/components/TaskCard.tsx`**

Remove the outer `<Card>` wrapper's non-link behavior and ensure it renders cleanly inside a `<Link>`. Add `className` for hover effect:

Replace the TaskCard component. Keep the same imports but change the card:

```tsx
import type { TaskResponse } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatRelativeTime, getTimeRemaining } from "@/lib/format"

const statusConfig = {
  ok: { label: "OK", variant: "default" as const, className: "bg-emerald-500 hover:bg-emerald-500 text-white" },
  offline: { label: "Offline", variant: "destructive" as const, className: "" },
  failing: { label: "Failing", variant: "destructive" as const, className: "bg-amber-500 hover:bg-amber-500 text-white" },
}

interface TaskCardProps {
  task: TaskResponse
}

export function TaskCard({ task }: TaskCardProps) {
  const cfg = statusConfig[task.status]
  const remaining = getTimeRemaining(task.next_deadline)

  return (
    <Card className={`transition-shadow hover:shadow-md ${task.status !== "ok" ? "border-destructive/50" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">{task.name}</CardTitle>
        <Badge variant={cfg.variant} className={cfg.className}>
          {cfg.label}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-1 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Last ping</span>
            <span className="font-mono">{formatRelativeTime(task.last_ping_at)}</span>
          </div>
          {task.status === "ok" && remaining && (
            <div className="flex justify-between">
              <span>Deadline</span>
              <span className="font-mono">{remaining}</span>
            </div>
          )}
          {task.last_ping_message && (
            <div className="mt-1 truncate text-xs" title={task.last_ping_message}>
              {task.last_ping_message}
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span>Timeout</span>
            <span>{task.timeout_hours}h</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/main.tsx frontend/src/App.tsx frontend/src/pages/Dashboard.tsx frontend/src/components/TaskCard.tsx
git commit -m "feat: add React Router with Dashboard and AuthGate shell"
```

---

### Task 14: Frontend AddTaskDialog + IntegrationGuide

**Files:**
- Create: `frontend/src/components/AddTaskDialog.tsx`
- Create: `frontend/src/components/IntegrationGuide.tsx`

- [ ] **Step 1: Create `frontend/src/components/IntegrationGuide.tsx`**

```tsx
import { useState } from "react"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface IntegrationGuideProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="outline" size="xs" onClick={handleCopy}>
      {copied ? "Copied!" : "Copy"}
    </Button>
  )
}

export function IntegrationGuide({ open, onOpenChange, taskId }: IntegrationGuideProps) {
  const baseUrl = window.location.origin
  const tokenPlaceholder = "YOUR_API_TOKEN"

  const curlSuccess = `curl -X POST ${baseUrl}/api/v1/ping \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{"task_id": "${taskId}", "status": "success", "message": "Backup completed"}'`

  const curlFailure = `curl -X POST ${baseUrl}/api/v1/ping \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{"task_id": "${taskId}", "status": "failed", "message": "Error: disk full"}'`

  const crontab = `0 3 * * * /path/to/backup.sh && curl -s -X POST ${baseUrl}/api/v1/ping -H "Authorization: Bearer ${tokenPlaceholder}" -H "Content-Type: application/json" -d '{"task_id":"${taskId}","status":"success"}'`

  const shellScript = `#!/bin/bash
SENTINEL_URL="${baseUrl}/api/v1/ping"
SENTINEL_TOKEN="${tokenPlaceholder}"
TASK_ID="${taskId}"

if your_command; then
  curl -sf -X POST "$SENTINEL_URL" \\
    -H "Authorization: Bearer $SENTINEL_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "{\\"task_id\\":\\"$TASK_ID\\",\\"status\\":\\"success\\",\\"message\\":\\"OK\\"}"
else
  curl -sf -X POST "$SENTINEL_URL" \\
    -H "Authorization: Bearer $SENTINEL_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "{\\"task_id\\":\\"$TASK_ID\\",\\"status\\":\\"failed\\",\\"message\\":\\"Exit code: $?\\"}"
fi`

  const sections = [
    { title: "curl Examples", content: `# Success\n${curlSuccess}\n\n# Failure\n${curlFailure}` },
    { title: "Crontab Example", content: crontab },
    { title: "Shell Script Template", content: shellScript },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Integration Guide</DialogTitle>
        <DialogDescription>
          Use these commands to report task status to Task Sentinel.
          Replace <code className="font-mono text-xs bg-muted px-1 rounded">{tokenPlaceholder}</code> with
          the API token from your <code className="font-mono text-xs bg-muted px-1 rounded">.env</code> file.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{section.title}</h4>
              <CopyButton text={section.content} />
            </div>
            <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
              <code>{section.content}</code>
            </pre>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)}>Done</Button>
      </DialogFooter>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/AddTaskDialog.tsx`**

```tsx
import { useState } from "react"
import { useAuth } from "@/lib/context"
import { createTask } from "@/lib/api"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { IntegrationGuide } from "@/components/IntegrationGuide"

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function AddTaskDialog({ open, onOpenChange, onCreated }: AddTaskDialogProps) {
  const { token } = useAuth()
  const [name, setName] = useState("")
  const [timeoutHours, setTimeoutHours] = useState("24")
  const [alertInterval, setAlertInterval] = useState("4")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const task = await createTask(
        {
          name,
          timeout_hours: parseFloat(timeoutHours),
          alert_interval_hours: parseFloat(alertInterval),
          description: description || undefined,
        },
        token,
      )
      setCreatedTaskId(task.id)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setName("")
      setTimeoutHours("24")
      setAlertInterval("4")
      setDescription("")
      setError(null)
      setCreatedTaskId(null)
      onOpenChange(false)
    }
  }

  if (createdTaskId) {
    return (
      <>
        <Dialog open={false} onOpenChange={handleClose} />
        <IntegrationGuide
          open={!!createdTaskId}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setCreatedTaskId(null)
              handleClose(false)
            }
          }}
          taskId={createdTaskId}
        />
      </>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>
            Create a new monitored task.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Backup"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (hours)</Label>
              <Input
                id="timeout"
                type="number"
                step="0.5"
                min="0.5"
                value={timeoutHours}
                onChange={(e) => setTimeoutHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-interval">Alert Interval (hours)</Label>
              <Input
                id="alert-interval"
                type="number"
                step="0.5"
                min="0.5"
                value={alertInterval}
                onChange={(e) => setAlertInterval(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AddTaskDialog.tsx frontend/src/components/IntegrationGuide.tsx
git commit -m "feat: add AddTaskDialog and IntegrationGuide components"
```

---

### Task 15: Frontend UptimeBar + PingLogList + EditTaskDialog

**Files:**
- Create: `frontend/src/components/UptimeBar.tsx`
- Create: `frontend/src/components/PingLogList.tsx`
- Create: `frontend/src/components/EditTaskDialog.tsx`

- [ ] **Step 1: Create `frontend/src/components/UptimeBar.tsx`**

```tsx
import type { UptimeDayResponse } from "@/lib/types"

const colorMap: Record<string, string> = {
  ok: "bg-emerald-500",
  mixed: "bg-amber-500",
  failed: "bg-red-500",
  none: "bg-muted",
}

interface UptimeBarProps {
  data: UptimeDayResponse[]
}

export function UptimeBar({ data }: UptimeBarProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {data.map((day) => (
        <div
          key={day.date}
          className={`h-3 w-3 rounded-sm ${colorMap[day.status]}`}
          title={`${day.date}: ${day.ok_count} OK, ${day.fail_count} failed`}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/PingLogList.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react"
import type { PingLogResponse } from "@/lib/types"
import { fetchTaskLogs } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import { Button } from "@/components/ui/button"

interface PingLogListProps {
  taskId: string
}

const PAGE_SIZE = 20

export function PingLogList({ taskId }: PingLogListProps) {
  const [logs, setLogs] = useState<PingLogResponse[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (currentOffset: number) => {
    setLoading(true)
    try {
      const data = await fetchTaskLogs(taskId, PAGE_SIZE, currentOffset)
      if (currentOffset === 0) {
        setLogs(data)
      } else {
        setLogs((prev) => [...prev, ...data])
      }
      setHasMore(data.length === PAGE_SIZE)
    } catch {
      // Silently fail — logs are non-critical
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    load(0)
  }, [load])

  const loadMore = () => {
    const nextOffset = offset + PAGE_SIZE
    setOffset(nextOffset)
    load(nextOffset)
  }

  if (logs.length === 0 && !loading) {
    return <p className="text-sm text-muted-foreground">No ping logs yet.</p>
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"
          >
            <span className={log.status === "success" ? "text-emerald-500" : "text-destructive"}>
              {log.status === "success" ? "✓" : "✗"}
            </span>
            <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">
              {formatRelativeTime(log.created_at)}
            </span>
            <span className="truncate text-muted-foreground">
              {log.message || "—"}
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <Button variant="ghost" size="sm" onClick={loadMore} disabled={loading}>
          {loading ? "Loading..." : "Load more"}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/src/components/EditTaskDialog.tsx`**

```tsx
import { useEffect, useState } from "react"
import type { TaskResponse } from "@/lib/types"
import { useAuth } from "@/lib/context"
import { updateTask } from "@/lib/api"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface EditTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskResponse
  onUpdated: () => void
}

export function EditTaskDialog({ open, onOpenChange, task, onUpdated }: EditTaskDialogProps) {
  const { token } = useAuth()
  const [name, setName] = useState(task.name)
  const [timeoutHours, setTimeoutHours] = useState(String(task.timeout_hours))
  const [alertInterval, setAlertInterval] = useState(String(task.alert_interval_hours))
  const [description, setDescription] = useState(task.description || "")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setName(task.name)
    setTimeoutHours(String(task.timeout_hours))
    setAlertInterval(String(task.alert_interval_hours))
    setDescription(task.description || "")
  }, [task])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      await updateTask(
        task.id,
        {
          name,
          timeout_hours: parseFloat(timeoutHours),
          alert_interval_hours: parseFloat(alertInterval),
          description: description || null,
        },
        token,
      )
      onUpdated()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update task settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-timeout">Timeout (hours)</Label>
              <Input
                id="edit-timeout"
                type="number"
                step="0.5"
                min="0.5"
                value={timeoutHours}
                onChange={(e) => setTimeoutHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-alert-interval">Alert Interval (hours)</Label>
              <Input
                id="edit-alert-interval"
                type="number"
                step="0.5"
                min="0.5"
                value={alertInterval}
                onChange={(e) => setAlertInterval(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/UptimeBar.tsx frontend/src/components/PingLogList.tsx frontend/src/components/EditTaskDialog.tsx
git commit -m "feat: add UptimeBar, PingLogList, and EditTaskDialog components"
```

---

### Task 16: Frontend TaskDetail Page

**Files:**
- Create: `frontend/src/pages/TaskDetail.tsx`

- [ ] **Step 1: Create `frontend/src/pages/TaskDetail.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import type { TaskResponse, UptimeDayResponse } from "@/lib/types"
import { fetchTask, fetchTaskUptime, deleteTask } from "@/lib/api"
import { useAuth } from "@/lib/context"
import { formatRelativeTime, formatDateTime, getTimeRemaining } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { UptimeBar } from "@/components/UptimeBar"
import { PingLogList } from "@/components/PingLogList"
import { EditTaskDialog } from "@/components/EditTaskDialog"

const statusConfig = {
  ok: { label: "OK", variant: "default" as const, className: "bg-emerald-500 hover:bg-emerald-500 text-white" },
  offline: { label: "Offline", variant: "destructive" as const, className: "" },
  failing: { label: "Failing", variant: "destructive" as const, className: "bg-amber-500 hover:bg-amber-500 text-white" },
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin, token } = useAuth()
  const [task, setTask] = useState<TaskResponse | null>(null)
  const [uptime, setUptime] = useState<UptimeDayResponse[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [t, u] = await Promise.all([
        fetchTask(id),
        fetchTaskUptime(id, 90),
      ])
      setTask(t)
      setUptime(u)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load task")
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async () => {
    if (!id || !token) return
    if (!window.confirm(`Delete task "${task?.name}"? This will also delete all ping logs.`)) return
    setDeleting(true)
    try {
      await deleteTask(id, token)
      navigate("/")
    } catch {
      // Show error but stay on page
    } finally {
      setDeleting(false)
    }
  }

  if (error && !task) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Dashboard
        </Link>
        <p className="mt-4 text-destructive">{error}</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const cfg = statusConfig[task.status]
  const remaining = getTimeRemaining(task.next_deadline)

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{task.name}</h1>
          <Badge variant={cfg.variant} className={cfg.className}>
            {cfg.label}
          </Badge>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div>
              <span className="text-muted-foreground">Task ID</span>
              <p className="font-mono">{task.id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Timeout</span>
              <p>{task.timeout_hours}h</p>
            </div>
            <div>
              <span className="text-muted-foreground">Alert Interval</span>
              <p>{task.alert_interval_hours}h</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Ping</span>
              <p className="font-mono">{formatRelativeTime(task.last_ping_at)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Next Deadline</span>
              <p className="font-mono">{remaining || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Message</span>
              <p className="truncate" title={task.last_ping_message || ""}>
                {task.last_ping_message || "—"}
              </p>
            </div>
            {task.description && (
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="text-muted-foreground">Description</span>
                <p>{task.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Uptime Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Uptime (Last 90 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <UptimeBar data={uptime} />
        </CardContent>
      </Card>

      {/* Ping Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Ping History</CardTitle>
        </CardHeader>
        <CardContent>
          <PingLogList taskId={task.id} />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {showEdit && (
        <EditTaskDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          task={task}
          onUpdated={load}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/TaskDetail.tsx
git commit -m "feat: add TaskDetail page with uptime timeline and ping log history"
```

---

## Phase 3: Polish & Verification

### Task 17: Frontend Build Verification

**Files:**
- No file changes expected

- [ ] **Step 1: Build frontend**

Run: `cd frontend && npm run build`
Expected: No TypeScript errors, no build errors.

- [ ] **Step 2: Fix any build errors**

If there are import errors or type mismatches, fix them.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve frontend build errors"
```

---

### Task 18: Backend Full Test Run + Final Verification

**Files:**
- No file changes expected

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All tests pass.

- [ ] **Step 2: Verify config.yml is deleted**

Run: `test ! -f config.yml && echo "config.yml removed" || echo "config.yml still exists"`
Expected: "config.yml removed"

- [ ] **Step 3: Verify requirements.txt**

Run: `grep -c pyyaml backend/requirements.txt || echo "pyyaml removed"`
Run: `grep pyjwt backend/requirements.txt`
Expected: pyyaml removed, pyjwt present.

- [ ] **Step 4: Start dev server and smoke test**

Run: `cd backend && python -m uvicorn app.main:app --reload &`

Test the auth flow:
```bash
# Check password
curl -s -X POST http://localhost:8000/api/v1/auth/check \
  -H "Content-Type: application/json" \
  -d '{"password": "admin"}'

# Create a task (use token from above)
curl -s -X POST http://localhost:8000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"name": "Test Task", "timeout_hours": 24, "alert_interval_hours": 4}'

# Get dashboard
curl -s http://localhost:8000/api/v1/dashboard

# Get uptime
curl -s http://localhost:8000/api/v1/tasks/test-task/uptime?days=7
```

Kill the dev server after testing.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve backend verification issues"
```

---

### Task 19: Docker Compose Verification

**Files:**
- No file changes expected

- [ ] **Step 1: Build Docker image**

Run: `docker compose build`
Expected: Successful multi-stage build (Node frontend + Python backend).

- [ ] **Step 2: Verify no config.yml volume in docker-compose.yml**

Run: `grep config.yml docker-compose.yml || echo "No config.yml reference found"`
Expected: "No config.yml reference found"

- [ ] **Step 3: Commit any Docker fixes**

```bash
git add -A
git commit -m "fix: resolve Docker configuration issues"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Remove `config.yml`, manage tasks online — Task 6
- ✅ React Router with `/` and `/tasks/:id` — Task 13
- ✅ Admin auth with JWT (`ADMIN_PASSWORD` env var) — Tasks 2, 3, 7
- ✅ `POST /api/v1/auth/check` — Task 7
- ✅ `POST /api/v1/tasks` (admin) — Task 8
- ✅ `PATCH /api/v1/tasks/{id}` (admin) — Task 8
- ✅ `DELETE /api/v1/tasks/{id}` (admin, cascade logs) — Task 8
- ✅ `GET /api/v1/tasks/{id}/uptime` — Task 9
- ✅ `GET /api/v1/tasks/{id}/logs` with `offset` — Task 8
- ✅ Task model `description` column — Task 5
- ✅ All Pydantic schemas — Task 4
- ✅ ID slugify with collision handling — Task 8
- ✅ Remove `_load_tasks_from_config()` — Task 6
- ✅ Remove `CONFIG_PATH` — Task 2
- ✅ Remove `pyyaml`, add `pyjwt` — Task 3
- ✅ Delete `config.yml` — Task 6
- ✅ Remove config.yml volume from docker-compose — Task 6
- ✅ `react-router-dom` dependency — Task 11
- ✅ New frontend files (auth.ts, context.tsx, Dashboard, TaskDetail, AddTaskDialog, IntegrationGuide, UptimeBar, PingLogList, AuthGate, EditTaskDialog) — Tasks 12-16
- ✅ Dashboard "+ Add Task" button — Task 13
- ✅ TaskCard clickable with Link — Task 13
- ✅ Empty state text update — Task 13
- ✅ Task detail layout (header, info, uptime, logs) — Task 16
- ✅ Integration guide with curl, crontab, shell script — Task 14
- ✅ UptimeBar pure CSS grid (90 days) — Task 15
- ✅ PingLogList paginated with "Load more" — Task 15
- ✅ Auth flow (localStorage, AuthGate, 24h expiry) — Task 12
- ✅ Error handling (409, 404, 401) — Tasks 7, 8, 9
- ✅ `.env.example` updates — Task 2
- ✅ SPA fallback routing for React Router — Task 10

**2. Placeholder scan:** No "TBD", "TODO", "implement later", "add appropriate error handling", or vague instructions. All code is complete and explicit.

**3. Type consistency:** All types match between tasks. `TaskResponse` includes `description` consistently. `UptimeDayResponse` fields match between backend schema and frontend type. API function signatures in `api.ts` match usage in components.
