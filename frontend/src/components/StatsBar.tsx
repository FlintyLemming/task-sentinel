import type { DashboardResponse } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"

interface StatsBarProps {
  data: DashboardResponse
}

export function StatsBar({ data }: StatsBarProps) {
  const stats = [
    { label: "Total", value: data.total, color: "text-foreground" },
    { label: "OK", value: data.ok_count, color: "text-emerald-500" },
    { label: "Failing", value: data.failing_count, color: "text-amber-500" },
    { label: "Offline", value: data.offline_count, color: "text-destructive" },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="flex flex-col items-center justify-center p-4">
            <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
