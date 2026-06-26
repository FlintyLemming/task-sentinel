import { useState } from "react"
import { useAuth } from "@/lib/context"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AuthGate() {
  const { login } = useAuth()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const success = await login(password)
    if (!success) {
      setError("Invalid password")
    }
    setLoading(false)
  }

  return (
    <Dialog open>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Admin Access</DialogTitle>
          <DialogDescription>
            Enter the admin password to manage tasks.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading || !password}>
            {loading ? "Verifying..." : "Unlock"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
