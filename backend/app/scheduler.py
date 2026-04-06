import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from .database import async_session
from .models import Task
from .notifier import send_telegram_alert

logger = logging.getLogger(__name__)


async def check_timeouts() -> None:
    async with async_session() as session:
        result = await session.execute(select(Task))
        tasks = result.scalars().all()

        now = datetime.now(timezone.utc)
        for task in tasks:
            await _check_single_task(session, task, now)

        await session.commit()


async def _check_single_task(session, task: Task, now: datetime) -> None:
    deadline: datetime | None = None
    if task.last_ping_at:
        ping_time = task.last_ping_at
        if ping_time.tzinfo is None:
            ping_time = ping_time.replace(tzinfo=timezone.utc)
        deadline = ping_time + timedelta(hours=task.timeout_hours)

    if deadline is None or now > deadline:
        if task.status == "ok":
            task.status = "offline"
            task.is_alert_active = True
            logger.warning("Task %s is now offline (timeout)", task.id)
            await _maybe_alert(session, task, now, reason="offline")
    else:
        if task.status in ("offline",) and task.last_ping_at:
            task.status = "ok"
            task.is_alert_active = False
            logger.info("Task %s recovered", task.id)


async def _maybe_alert(session, task: Task, now: datetime, reason: str) -> None:
    should_alert = False
    if task.last_alert_at is None:
        should_alert = True
    else:
        last = task.last_alert_at
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if now - last >= timedelta(hours=task.alert_interval_hours):
            should_alert = True

    if should_alert:
        success = await send_telegram_alert(task, reason)
        if success:
            task.last_alert_at = now
