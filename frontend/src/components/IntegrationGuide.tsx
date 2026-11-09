import { useEffect, useState } from "react"
import { useAuth } from "@/lib/context"
import { fetchApiToken } from "@/lib/api"
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface IntegrationGuideProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="outline" size="xs" onClick={handleCopy}>
      {copied ? "Copied!" : "Copy"}
    </Button>
  )
}

export function IntegrationGuide({ open, onOpenChange, taskId }: IntegrationGuideProps) {
  const { token } = useAuth()
  const [fetched, setFetched] = useState<{ token: string; apiToken: string } | null>(null)

  useEffect(() => {
    if (!open || !token) return
    let cancelled = false
    fetchApiToken(token)
      .then((resp) => {
        if (!cancelled) setFetched({ token, apiToken: resp.api_token })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, token])

  // Only use the fetched API token while the current admin session matches.
  const apiToken = token && fetched?.token === token ? fetched.apiToken : null

  const baseUrl = window.location.origin
  const placeholder = "YOUR_API_TOKEN"
  const tokenPlaceholder = apiToken ?? placeholder

  const curlSuccess = `curl -X POST ${baseUrl}/api/v1/ping \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{"task_id": "${taskId}", "status": "success", "message": "Backup completed"}'`

  const curlFailure = `curl -X POST ${baseUrl}/api/v1/ping \\
  -H "Authorization: Bearer ${tokenPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{"task_id": "${taskId}", "status": "failed", "message": "Error: disk full"}'`

  const crontab = `0 3 * * * /path/to/backup.sh && curl -s -X POST ${baseUrl}/api/v1/ping -H "Authorization: Bearer ${tokenPlaceholder}" -H "Content-Type: application/json" -d '{"task_id":"${taskId}","status":"success"}'`

  const shellScript = `#!/bin/bash
SENTINEL_URL="${baseUrl}/api/v1/ping"
SENTINEL_TOKEN="${tokenPlaceholder}"
TASK_ID="${taskId}"

if your_command; then
  curl -sf -X POST "$SENTINEL_URL" \\
    -H "Authorization: Bearer $SENTINEL_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "{\\"task_id\\":\\"$TASK_ID\\",\\"status\\":\\"success\\",\\"message\\":\\"OK\\"}"
else
  curl -sf -X POST "$SENTINEL_URL" \\
    -H "Authorization: Bearer $SENTINEL_TOKEN" \\
    -H "Content-Type: application/json" \\
    -d "{\\"task_id\\":\\"$TASK_ID\\",\\"status\\":\\"failed\\",\\"message\\":\\"Exit code: $?\\"}"
fi`

  const sections = [
    { title: "curl Examples", content: `# Success\n${curlSuccess}\n\n# Failure\n${curlFailure}` },
    { title: "Crontab Example", content: crontab },
    { title: "Shell Script Template", content: shellScript },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Integration Guide</DialogTitle>
        <DialogDescription>
          Use these commands to report task status to Task Sentinel.
          {apiToken ? (
            <> The API token is already filled in — copy and use directly.</>
          ) : (
            <>
              {" "}Replace <code className="font-mono text-xs bg-muted px-1 rounded">{placeholder}</code> with
              the API token from your <code className="font-mono text-xs bg-muted px-1 rounded">.env</code> file.
            </>
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{section.title}</h4>
              <CopyButton text={section.content} />
            </div>
            <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
              <code>{section.content}</code>
            </pre>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)}>Done</Button>
      </DialogFooter>
    </Dialog>
  )
}
