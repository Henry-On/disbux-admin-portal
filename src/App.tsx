import { AdminLayout } from './components/AdminLayout'
import { usePathname, navigate } from './services/router'
import { AnnouncementsPage } from './pages/AnnouncementsPage'
import { DashboardPage } from './pages/DashboardPage'
import { GiveawaysPage } from './pages/GiveawaysPage'
import { KycPage } from './pages/KycPage'
import { LoginPage } from './pages/LoginPage'

export default function App() {
  const path = usePathname()
  if (path === '/' || path === '/login') return <LoginPage />
  if (path === '/giveaways') return <GiveawaysPage />
  if (path === '/dashboard') return <AdminLayout active="/dashboard"><DashboardPage /></AdminLayout>
  if (path === '/kyc') return <AdminLayout active="/kyc"><KycPage /></AdminLayout>
  if (path === '/announcements') return <AdminLayout active="/announcements"><AnnouncementsPage /></AdminLayout>
  return <main className="page-shell"><section className="auth-card"><p className="eyebrow">DISBUX ADMIN</p><h1>Page not found</h1><button className="button primary" onClick={() => navigate('/dashboard')}>Go to dashboard</button></section></main>
}
