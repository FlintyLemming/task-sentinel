import type { TaskResponse } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatRelativeTime, getTimeRemaining } from "@/lib/format"

const statusConfig = {
  ok: { label: "OK", variant: "default" as const, className: "bg-emerald-500 hover:bg-emerald-500 text-white" },
  offline: { label: "Offline", variant: "destructive" as const, className: "" },
  failing: { label: "Failing", variant: "destructive" as const, className: "bg-amber-500 hover:bg-amber-500 text-white" },
}

interface TaskCardProps {
  task: TaskResponse
}

export function TaskCard({ task }: TaskCardProps) {
  const cfg = statusConfig[task.status]
  const remaining = getTimeRemaining(task.next_deadline)

  return (
    <Card className={`transition-shadow hover:shadow-md ${task.status !== "ok" ? "border-destructive/50" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">{task.name}</CardTitle>
        <Badge variant={cfg.variant} className={cfg.className}>
          {cfg.label}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-1 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Last ping</span>
            <span className="font-mono">{formatRelativeTime(task.last_ping_at)}</span>
          </div>
          {task.status === "ok" && remaining && (
            <div className="flex justify-between">
              <span>Deadline</span>
              <span className="font-mono">{remaining}</span>
            </div>
          )}
          {task.last_ping_message && (
            <div className="mt-1 truncate text-xs" title={task.last_ping_message}>
              {task.last_ping_message}
            </div>
          )}
          <div className="flex justify-between text-xs">
            <span>Timeout</span>
            <span>{task.timeout_hours}h</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
