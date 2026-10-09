import { Routes, Route, Navigate } from 'react-router-dom'
import RiderPage from './pages/RiderPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/rider" element={<RiderPage />} />
      <Route path="/" element={<DashboardPage />} />
      <Route path="*" element={<Navigate to="/rider" replace />} />
    </Routes>
  )
}
