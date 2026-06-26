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

    # data[6] = today (newest, start_date + 6 days)
    assert data[6]["status"] == "ok"
    assert data[6]["ok_count"] == 3
    assert data[6]["fail_count"] == 0

    # data[5] = yesterday
    assert data[5]["status"] == "mixed"
    assert data[5]["ok_count"] == 1
    assert data[5]["fail_count"] == 1

    # data[3] = 3 days ago
    assert data[3]["status"] == "failed"
    assert data[3]["ok_count"] == 0
    assert data[3]["fail_count"] == 2


@pytest.mark.asyncio
async def test_uptime_task_not_found(client: AsyncClient):
    resp = await client.get("/api/v1/tasks/nonexistent/uptime?days=7")
    assert resp.status_code == 404
