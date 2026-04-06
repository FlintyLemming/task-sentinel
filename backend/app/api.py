import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from .database import async_session
from .models import PingLog, Task
from .schemas import DashboardResponse, PingLogResponse, PingRequest, TaskResponse
from .config import settings

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
async def get_task_logs(task_id: str, limit: int = 50):
    async with async_session() as session:
        result = await session.execute(
            select(PingLog)
            .where(PingLog.task_id == task_id)
            .order_by(desc(PingLog.created_at))
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
