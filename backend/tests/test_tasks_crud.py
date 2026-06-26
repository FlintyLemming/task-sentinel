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
