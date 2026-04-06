from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    timeout_hours: Mapped[float] = mapped_column(Float, nullable=False)
    alert_interval_hours: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="offline")
    last_ping_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    last_ping_message: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True, default=None
    )
    last_alert_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    is_alert_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "timeout_hours": self.timeout_hours,
            "alert_interval_hours": self.alert_interval_hours,
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

    def _next_deadline(self) -> Optional[str]:
        if self.last_ping_at is None:
            return None
        deadline = self.last_ping_at + timedelta(hours=self.timeout_hours)
        return deadline.isoformat()


class PingLog(Base):
    __tablename__ = "ping_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    task_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
