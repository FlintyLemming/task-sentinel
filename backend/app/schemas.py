from typing import List, Optional

from pydantic import BaseModel, Field


class PingRequest(BaseModel):
    task_id: str
    status: str
    message: Optional[str] = None


class TaskResponse(BaseModel):
    id: str
    name: str
    timeout_hours: float
    alert_interval_hours: float
    description: Optional[str] = None
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


class AuthRequest(BaseModel):
    password: str


class AuthResponse(BaseModel):
    token: str


class ApiTokenResponse(BaseModel):
    api_token: str


class CreateTaskRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    timeout_hours: float = 24.0
    alert_interval_hours: float = 4.0
    description: Optional[str] = None


class UpdateTaskRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    timeout_hours: Optional[float] = None
    alert_interval_hours: Optional[float] = None
    description: Optional[str] = None


class UptimeDayResponse(BaseModel):
    date: str
    ok_count: int
    fail_count: int
    status: str
