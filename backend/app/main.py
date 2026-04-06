import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api import router
from .config import settings
from .database import init_db
from .scheduler import check_timeouts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

scheduler: Optional[AsyncIOScheduler] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global scheduler
    await init_db()
    logger.info("Database initialized")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        check_timeouts,
        "interval",
        seconds=settings.CHECK_INTERVAL_SECONDS,
        id="check_timeouts",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started (interval=%ds)", settings.CHECK_INTERVAL_SECONDS)

    yield

    if scheduler:
        scheduler.shutdown()
    logger.info("Shutdown complete")


app = FastAPI(title="Task Sentinel", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

frontend_dist = settings.FRONTEND_DIST or os.path.join(
    os.path.dirname(__file__), "..", "..", "frontend", "dist"
)
if os.path.isdir(frontend_dist):
    from fastapi.responses import FileResponse

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(frontend_dist, "index.html"))

    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
