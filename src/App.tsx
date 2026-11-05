import { Navigate, Route, Routes, useNavigate } from 'react-router'
import { AdminLayout } from './components/AdminLayout'
import { AnnouncementsPage } from './pages/AnnouncementsPage'
import { DashboardPage } from './pages/DashboardPage'
import { GiveawaysPage } from './pages/GiveawaysPage'
import { KycPage } from './pages/KycPage'
import { LoginPage } from './pages/LoginPage'

export default function App() {
  return <Routes>
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/giveaways" element={<GiveawaysPage />} />
    <Route path="/dashboard" element={<AdminLayout><DashboardPage /></AdminLayout>} />
    <Route path="/kyc" element={<AdminLayout><KycPage /></AdminLayout>} />
    <Route path="/announcements" element={<AdminLayout><AnnouncementsPage /></AdminLayout>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
}

function NotFound() {
  const navigate = useNavigate()
  return <main className="page-shell"><section className="auth-card"><p className="eyebrow">DISBUX ADMIN</p><h1>Page not found</h1><button className="button primary" onClick={() => navigate('/dashboard')}>Go to dashboard</button></section></main>
}
