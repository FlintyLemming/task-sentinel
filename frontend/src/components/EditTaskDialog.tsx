import { useEffect, useState } from "react"
import type { TaskResponse } from "@/lib/types"
import { useAuth } from "@/lib/context"
import { updateTask } from "@/lib/api"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface EditTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskResponse
  onUpdated: () => void
}

export function EditTaskDialog({ open, onOpenChange, task, onUpdated }: EditTaskDialogProps) {
  const { token } = useAuth()
  const [name, setName] = useState(task.name)
  const [timeoutHours, setTimeoutHours] = useState(String(task.timeout_hours))
  const [alertInterval, setAlertInterval] = useState(String(task.alert_interval_hours))
  const [description, setDescription] = useState(task.description || "")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setName(task.name)
    setTimeoutHours(String(task.timeout_hours))
    setAlertInterval(String(task.alert_interval_hours))
    setDescription(task.description || "")
  }, [task])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      await updateTask(
        task.id,
        {
          name,
          timeout_hours: parseFloat(timeoutHours),
          alert_interval_hours: parseFloat(alertInterval),
          description: description || null,
        },
        token,
      )
      onUpdated()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update task settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-timeout">Timeout (hours)</Label>
              <Input
                id="edit-timeout"
                type="number"
                step="0.5"
                min="0.5"
                value={timeoutHours}
                onChange={(e) => setTimeoutHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-alert-interval">Alert Interval (hours)</Label>
              <Input
                id="edit-alert-interval"
                type="number"
                step="0.5"
                min="0.5"
                value={alertInterval}
                onChange={(e) => setAlertInterval(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
