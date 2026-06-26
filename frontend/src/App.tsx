import { Routes, Route } from "react-router-dom"
import { useAuth } from "@/lib/context"
import { AuthGate } from "@/components/AuthGate"
import Dashboard from "@/pages/Dashboard"
import TaskDetail from "@/pages/TaskDetail"

export default function App() {
  const { isAdmin } = useAuth()

  return (
    <>
      {!isAdmin && <AuthGate />}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
      </Routes>
    </>
  )
}
