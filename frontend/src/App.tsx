import { Routes, Route } from "react-router-dom"
import Dashboard from "@/pages/Dashboard"
import TaskDetail from "@/pages/TaskDetail"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/tasks/:id" element={<TaskDetail />} />
    </Routes>
  )
}
