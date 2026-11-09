import type {
  DashboardResponse,
  PingLogResponse,
  TaskResponse,
  UptimeDayResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "./types"

const API_BASE = "/api/v1"

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!resp.ok) {
    const body = await resp.json().catch(() => null)
    throw new Error(body?.detail || `Request failed: ${resp.status}`)
  }
  if (resp.status === 204) return undefined as T
  return resp.json()
}

function adminHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

// Public endpoints
export async function fetchDashboard(): Promise<DashboardResponse> {
  return request<DashboardResponse>("/dashboard")
}

export async function fetchTask(taskId: string): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${encodeURIComponent(taskId)}`)
}

export async function fetchTaskLogs(
  taskId: string,
  limit = 20,
  offset = 0,
): Promise<PingLogResponse[]> {
  return request<PingLogResponse[]>(
    `/tasks/${encodeURIComponent(taskId)}/logs?limit=${limit}&offset=${offset}`,
  )
}

export async function fetchTaskUptime(
  taskId: string,
  days = 90,
): Promise<UptimeDayResponse[]> {
  return request<UptimeDayResponse[]>(
    `/tasks/${encodeURIComponent(taskId)}/uptime?days=${days}`,
  )
}

// Auth endpoint
export async function checkPassword(password: string): Promise<{ token: string }> {
  return request<{ token: string }>("/auth/check", {
    method: "POST",
    body: JSON.stringify({ password }),
  })
}

// Admin endpoints
export async function fetchApiToken(token: string): Promise<{ api_token: string }> {
  return request<{ api_token: string }>("/auth/api-token", {
    headers: adminHeaders(token),
  })
}

export async function createTask(
  data: CreateTaskRequest,
  token: string,
): Promise<TaskResponse> {
  return request<TaskResponse>("/tasks", {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json", ...adminHeaders(token) },
  })
}

export async function updateTask(
  id: string,
  data: UpdateTaskRequest,
  token: string,
): Promise<TaskResponse> {
  return request<TaskResponse>(`/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json", ...adminHeaders(token) },
  })
}

export async function deleteTask(id: string, token: string): Promise<void> {
  return request<void>(`/tasks/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: adminHeaders(token),
  })
}
