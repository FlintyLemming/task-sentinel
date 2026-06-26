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
