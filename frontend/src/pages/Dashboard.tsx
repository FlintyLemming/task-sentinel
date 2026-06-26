import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type { DashboardResponse } from "@/lib/types"
import { fetchDashboard } from "@/lib/api"
import { useAuth } from "@/lib/context"
import { StatsBar } from "@/components/StatsBar"
import { TaskCard } from "@/components/TaskCard"
import { AddTaskDialog } from "@/components/AddTaskDialog"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

const REFRESH_INTERVAL = 15_000

export default function Dashboard() {
  const { isAdmin, logout } = useAuth()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await fetchDashboard()
      setData(d)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    }
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-destructive">Failed to load: {error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Task Sentinel</h1>
          <p className="text-sm text-muted-foreground">
            Task monitoring dashboard
            {lastUpdated && (
              <span className="ml-2">
                &middot; Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button onClick={() => setShowAdd(true)}>+ Add Task</Button>
              <Button variant="ghost" size="sm" onClick={logout}>Lock</Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      <StatsBar data={data} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.tasks.map((task) => (
          <Link key={task.id} to={`/tasks/${task.id}`}>
            <TaskCard task={task} />
          </Link>
        ))}
      </div>

      {data.tasks.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          {isAdmin
            ? "Click '+ Add Task' to create your first task"
            : "No tasks configured."}
        </div>
      )}

      {showAdd && <AddTaskDialog open={showAdd} onOpenChange={setShowAdd} onCreated={load} />}
    </div>
  )
}
