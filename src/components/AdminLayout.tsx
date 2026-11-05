import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { Auth, clearSession, hasRefreshToken, hasSession } from '../services/api'

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/kyc', label: 'KYC reviews' },
  { to: '/announcements', label: 'Announcements' },
]

export function AdminLayout({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState('')
  const [ready, setReady] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    async function checkSession() {
      try {
        if (!hasSession() && hasRefreshToken()) await Auth.refresh()
        if (!hasSession()) throw new Error('Missing session')
        const identity = await Auth.me()
        if (!identity.data?.email) throw new Error('Invalid session')
        if (mounted) { setEmail(identity.data.email); setReady(true) }
      } catch {
        clearSession()

        navigate('/login', { replace: true, state: { from: location } })
      }
    }
    void checkSession()
    return () => { mounted = false }
  }, [location.pathname, location.search, navigate])

  async function signOut() {
    try { await Auth.logout() } catch { /* always leave the protected area */ } finally { navigate('/login', { replace: true }) }
  }

  if (!ready) return <main className="page-shell"><div className="empty-state">Checking admin session…</div></main>
  return <div className="portal">
    <header className="portal-topbar">
      <Link className="brand" to="/dashboard"><img src="/images/logo.png" alt="Disbux" /><span>Admin</span></Link>
      <button className="nav-toggle" type="button" aria-expanded={menuOpen} aria-controls="portal-nav" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
    </header>
    <aside className={`sidebar${menuOpen ? ' open' : ''}`} id="portal-nav" aria-label="Admin navigation">
      <Link className="brand" to="/dashboard"><img src="/images/logo.png" alt="Disbux" /><span>Admin Portal</span></Link>
      <span className="nav-label">Manage</span>
      {links.map((link) => <NavLink key={link.to} className="nav-link" to={link.to}>{link.label}</NavLink>)}
      <span className="nav-label">Site</span>
      <a className="nav-link" href="https://disbux.com">View website</a>
      <div className="sidebar-footer"><span className="account-email">{email}</span><button className="button outline" type="button" onClick={() => void signOut()}>Sign out</button></div>
    </aside>
    <main className="portal-main">{children}</main>
  </div>
}

export function Notice({ message, kind = '' }: { message: string; kind?: '' | 'error' | 'success' }) {
  return message ? <p className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{message}</p> : null
}

export function Modal({ title, eyebrow, wide = false, onClose, children }: { title: string; eyebrow: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className={`modal-card${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><div><p className="eyebrow">{eyebrow}</p><h2 id="modal-title">{title}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close">×</button></div>
      {children}
    </section>
  </div>
}
