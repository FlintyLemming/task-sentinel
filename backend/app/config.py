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
