import { useState } from "react"
import { useAuth } from "@/lib/context"
import { createTask } from "@/lib/api"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { IntegrationGuide } from "@/components/IntegrationGuide"

interface AddTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

export function AddTaskDialog({ open, onOpenChange, onCreated }: AddTaskDialogProps) {
  const { token } = useAuth()
  const [name, setName] = useState("")
  const [timeoutHours, setTimeoutHours] = useState("24")
  const [alertInterval, setAlertInterval] = useState("4")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const task = await createTask(
        {
          name,
          timeout_hours: parseFloat(timeoutHours),
          alert_interval_hours: parseFloat(alertInterval),
          description: description || undefined,
        },
        token,
      )
      setCreatedTaskId(task.id)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setName("")
      setTimeoutHours("24")
      setAlertInterval("4")
      setDescription("")
      setError(null)
      setCreatedTaskId(null)
      onOpenChange(false)
    }
  }

  if (createdTaskId) {
    return (
      <>
        <Dialog open={false} onOpenChange={handleClose} />
        <IntegrationGuide
          open={!!createdTaskId}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setCreatedTaskId(null)
              handleClose(false)
            }
          }}
          taskId={createdTaskId}
        />
      </>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>
            Create a new monitored task.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Backup"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout (hours)</Label>
              <Input
                id="timeout"
                type="number"
                step="0.5"
                min="0.5"
                value={timeoutHours}
                onChange={(e) => setTimeoutHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-interval">Alert Interval (hours)</Label>
              <Input
                id="alert-interval"
                type="number"
                step="0.5"
                min="0.5"
                value={alertInterval}
                onChange={(e) => setAlertInterval(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !name.trim()}>
            {loading ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
