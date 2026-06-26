export interface TaskResponse {
  id: string
  name: string
  timeout_hours: number
  alert_interval_hours: number
  description: string | null
  status: "ok" | "offline" | "failing"
  last_ping_at: string | null
  last_ping_message: string | null
  last_alert_at: string | null
  is_alert_active: boolean
  next_deadline: string | null
}

export interface DashboardResponse {
  tasks: TaskResponse[]
  total: number
  ok_count: number
  failing_count: number
  offline_count: number
}

export interface PingLogResponse {
  id: number
  task_id: string
  status: string
  message: string | null
  created_at: string
}

export interface UptimeDayResponse {
  date: string
  ok_count: number
  fail_count: number
  status: "ok" | "mixed" | "failed" | "none"
}

export interface CreateTaskRequest {
  name: string
  timeout_hours?: number
  alert_interval_hours?: number
  description?: string
}

export interface UpdateTaskRequest {
  name?: string
  timeout_hours?: number
  alert_interval_hours?: number
  description?: string
}
