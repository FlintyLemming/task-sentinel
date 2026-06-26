import { useCallback, useEffect, useState } from "react"
import type { PingLogResponse } from "@/lib/types"
import { fetchTaskLogs } from "@/lib/api"
import { formatRelativeTime } from "@/lib/format"
import { Button } from "@/components/ui/button"

interface PingLogListProps {
  taskId: string
}

const PAGE_SIZE = 20

export function PingLogList({ taskId }: PingLogListProps) {
  const [logs, setLogs] = useState<PingLogResponse[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (currentOffset: number) => {
    setLoading(true)
    try {
      const data = await fetchTaskLogs(taskId, PAGE_SIZE, currentOffset)
      if (currentOffset === 0) {
        setLogs(data)
      } else {
        setLogs((prev) => [...prev, ...data])
      }
      setHasMore(data.length === PAGE_SIZE)
    } catch {
      // Silently fail — logs are non-critical
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    load(0)
  }, [load])

  const loadMore = () => {
    const nextOffset = offset + PAGE_SIZE
    setOffset(nextOffset)
    load(nextOffset)
  }

  if (logs.length === 0 && !loading) {
    return <p className="text-sm text-muted-foreground">No ping logs yet.</p>
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"
          >
            <span className={log.status === "success" ? "text-emerald-500" : "text-destructive"}>
              {log.status === "success" ? "✓" : "✗"}
            </span>
            <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">
              {formatRelativeTime(log.created_at)}
            </span>
            <span className="truncate text-muted-foreground">
              {log.message || "—"}
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <Button variant="ghost" size="sm" onClick={loadMore} disabled={loading}>
          {loading ? "Loading..." : "Load more"}
        </Button>
      )}
    </div>
  )
}
