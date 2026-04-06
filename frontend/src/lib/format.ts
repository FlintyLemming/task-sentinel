export function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "Never"

  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return `${diffSeconds}s ago`
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export function formatDateTime(isoString: string | null): string {
  if (!isoString) return "—"
  return new Date(isoString).toLocaleString()
}

export function getTimeRemaining(isoString: string | null): string | null {
  if (!isoString) return null
  const deadline = new Date(isoString)
  const now = new Date()
  const diffMs = deadline.getTime() - now.getTime()
  if (diffMs <= 0) return "Overdue"
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (diffHours > 0) return `${diffHours}h ${diffMinutes}m remaining`
  return `${diffMinutes}m remaining`
}
