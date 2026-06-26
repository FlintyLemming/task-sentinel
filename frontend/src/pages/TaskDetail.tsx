import { useCallback, useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import type { TaskResponse, UptimeDayResponse } from "@/lib/types"
import { fetchTask, fetchTaskUptime, deleteTask } from "@/lib/api"
import { useAuth } from "@/lib/context"
import { formatRelativeTime, getTimeRemaining } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { UptimeBar } from "@/components/UptimeBar"
import { PingLogList } from "@/components/PingLogList"
import { EditTaskDialog } from "@/components/EditTaskDialog"

const statusConfig = {
  ok: { label: "OK", variant: "default" as const, className: "bg-emerald-500 hover:bg-emerald-500 text-white" },
  offline: { label: "Offline", variant: "destructive" as const, className: "" },
  failing: { label: "Failing", variant: "destructive" as const, className: "bg-amber-500 hover:bg-amber-500 text-white" },
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAdmin, token } = useAuth()
  const [task, setTask] = useState<TaskResponse | null>(null)
  const [uptime, setUptime] = useState<UptimeDayResponse[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [t, u] = await Promise.all([
        fetchTask(id),
        fetchTaskUptime(id, 90),
      ])
      setTask(t)
      setUptime(u)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load task")
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async () => {
    if (!id || !token) return
    if (!window.confirm(`Delete task "${task?.name}"? This will also delete all ping logs.`)) return
    setDeleting(true)
    try {
      await deleteTask(id, token)
      navigate("/")
    } catch {
      // Show error but stay on page
    } finally {
      setDeleting(false)
    }
  }

  if (error && !task) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Dashboard
        </Link>
        <p className="mt-4 text-destructive">{error}</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const cfg = statusConfig[task.status]
  const remaining = getTimeRemaining(task.next_deadline)

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{task.name}</h1>
          <Badge variant={cfg.variant} className={cfg.className}>
            {cfg.label}
          </Badge>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <div>
              <span className="text-muted-foreground">Task ID</span>
              <p className="font-mono">{task.id}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Timeout</span>
              <p>{task.timeout_hours}h</p>
            </div>
            <div>
              <span className="text-muted-foreground">Alert Interval</span>
              <p>{task.alert_interval_hours}h</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Ping</span>
              <p className="font-mono">{formatRelativeTime(task.last_ping_at)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Next Deadline</span>
              <p className="font-mono">{remaining || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Message</span>
              <p className="truncate" title={task.last_ping_message || ""}>
                {task.last_ping_message || "—"}
              </p>
            </div>
            {task.description && (
              <div className="sm:col-span-2 lg:col-span-3">
                <span className="text-muted-foreground">Description</span>
                <p>{task.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Uptime Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Uptime (Last 90 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <UptimeBar data={uptime} />
        </CardContent>
      </Card>

      {/* Ping Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Ping History</CardTitle>
        </CardHeader>
        <CardContent>
          <PingLogList taskId={task.id} />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {showEdit && (
        <EditTaskDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          task={task}
          onUpdated={load}
        />
      )}
    </div>
  )
}
