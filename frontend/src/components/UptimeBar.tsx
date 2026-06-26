import type { UptimeDayResponse } from "@/lib/types"

const colorMap: Record<string, string> = {
  ok: "bg-emerald-500",
  mixed: "bg-amber-500",
  failed: "bg-red-500",
  none: "bg-muted",
}

interface UptimeBarProps {
  data: UptimeDayResponse[]
}

export function UptimeBar({ data }: UptimeBarProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {data.map((day) => (
        <div
          key={day.date}
          className={`h-3 w-3 rounded-sm ${colorMap[day.status]}`}
          title={`${day.date}: ${day.ok_count} OK, ${day.fail_count} failed`}
        />
      ))}
    </div>
  )
}
