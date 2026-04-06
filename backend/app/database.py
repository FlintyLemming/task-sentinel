from pathlib import Path

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from .config import settings
from .models import Base, Task

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _load_tasks_from_config()


async def _load_tasks_from_config() -> None:
    config_path = Path(settings.CONFIG_PATH)
    if not config_path.exists():
        return

    with open(config_path) as f:
        config = yaml.safe_load(f)

    tasks_cfg = config.get("tasks", [])
    if not tasks_cfg:
        return

    async with async_session() as session:
        for t in tasks_cfg:
            result = await session.execute(select(Task).where(Task.id == t["id"]))
            existing = result.scalar_one_or_none()
            if existing:
                existing.name = t["name"]
                existing.timeout_hours = t["timeout_hours"]
                existing.alert_interval_hours = t["alert_interval_hours"]
            else:
                session.add(
                    Task(
                        id=t["id"],
                        name=t["name"],
                        timeout_hours=t["timeout_hours"],
                        alert_interval_hours=t["alert_interval_hours"],
                        status="offline",
                    )
                )
        await session.commit()
