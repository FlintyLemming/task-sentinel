import type { DashboardResponse, PingLogResponse } from "./types"

const API_BASE = "/api/v1"

export async function fetchDashboard(): Promise<DashboardResponse> {
  const resp = await fetch(`${API_BASE}/dashboard`)
  if (!resp.ok) throw new Error("Failed to fetch dashboard")
  return resp.json()
}

export async function fetchTaskLogs(taskId: string, limit = 20): Promise<PingLogResponse[]> {
  const resp = await fetch(`${API_BASE}/tasks/${encodeURIComponent(taskId)}/logs?limit=${limit}`)
  if (!resp.ok) throw new Error("Failed to fetch logs")
  return resp.json()
}
