from typing import List, Optional

from pydantic import BaseModel


class PingRequest(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = None


class TaskResponse(BaseModel):
    id: str
    name: str
    timeout_hours: float
    alert_interval_hours: float
    status: str
    last_ping_at: Optional[str] = None
    last_ping_message: Optional[str] = None
    last_alert_at: Optional[str] = None
    is_alert_active: bool
    next_deadline: Optional[str] = None


class DashboardResponse(BaseModel):
    tasks: List[TaskResponse]
    total: int
    ok_count: int
    failing_count: int
    offline_count: int


class PingLogResponse(BaseModel):
    id: int
    task_id: str
    status: str
    message: Optional[str] = None
    created_at: str
