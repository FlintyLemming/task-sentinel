import logging
import re
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import create_token, verify_admin
from .config import settings
from .database import async_session
from .models import PingLog, Task
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1")
security = HTTPBearer()


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> None:
    if credentials.credentials != settings.API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid token")


def _get_session():
    return async_session()


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s]+", "-", text)
    text = re.sub(r"-+", "-", text)
    text = text.strip("-")
    return text[:100]


@router.post("/auth/check", response_model=AuthResponse)
async def auth_check(body: AuthRequest):
    if body.password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    token = create_token("admin")
    return AuthResponse(token=token)


@router.post("/ping")
async def ping(
    body: PingRequest,
    credentials: HTTPAuthorizationCredentials = Security(security),
):
    await verify_token(credentials)

    async with async_session() as session:
        result = await session.execute(select(Task).where(Task.id == body.task_id))
        task = result.scalar_one_or_none()
        if task is None:
            raise HTTPException(
                status_code=404, detail=f"Task '{body.task_id}' not found"
            )

        now = datetime.now(timezone.utc)

        task.last_ping_at = now
        task.last_ping_message = body.message

        if body.status == "success":
            task.status = "ok"
            task.is_alert_active = False
        elif body.status == "failed":
            task.status = "failing"
            task.is_alert_active = True
        else:
            raise HTTPException(
                status_code=400, detail="status must be 'success' or 'failed'"
            )

        log = PingLog(
            task_id=body.task_id,
            status=body.status,
            message=body.message,
            created_at=now,
        )
        session.add(log)
        await session.commit()

        return {"ok": True, "task_id": body.task_id, "status": task.status}


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard():
    async with async_session() as session:
        result = await session.execute(select(Task).order_by(Task.name))
        tasks = result.scalars().all()

        ok_count = sum(1 for t in tasks if t.status == "ok")
        failing_count = sum(1 for t in tasks if t.status == "failing")
        offline_count = sum(1 for t in tasks if t.status == "offline")

        return DashboardResponse(
            tasks=[TaskResponse(**t.to_dict()) for t in tasks],
            total=len(tasks),
            ok_count=ok_count,
            failing_count=failing_count,
            offline_count=offline_count,
        )


@router.get("/tasks", response_model=list[TaskResponse])
async def list_tasks():
    async with async_session() as session:
        result = await session.execute(select(Task).order_by(Task.name))
        tasks = result.scalars().all()
        return [TaskResponse(**t.to_dict()) for t in tasks]


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str):
    async with async_session() as session:
        result = await session.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return TaskResponse(**task.to_dict())


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
