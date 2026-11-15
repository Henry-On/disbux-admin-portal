'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ClipboardCheck, LayoutDashboard, LogOut, Megaphone, Menu, X } from 'lucide-react'
import { Auth, clearSession, hasRefreshToken, hasSession } from '../services/api'
import { useAdminStore } from '../stores/adminStore'

const links = [
  { to: '/dashboard', label: 'Dashboard', permission: 'dashboard.view', Icon: LayoutDashboard },
  { to: '/kyc', label: 'KYC reviews', permission: 'kyc.view', Icon: ClipboardCheck },
  { to: '/announcements', label: 'Announcements', permission: 'announcements.view', Icon: Megaphone },
]

export function AdminLayout({ children, requiredPermission }: { children: ReactNode; requiredPermission: string }) {
  const email = useAdminStore((state) => state.email)
  const permissions = useAdminStore((state) => state.permissions)
  const menuOpen = useAdminStore((state) => state.menuOpen)
  const setIdentity = useAdminStore((state) => state.setIdentity)
  const clearIdentity = useAdminStore((state) => state.clearIdentity)
  const toggleMenu = useAdminStore((state) => state.toggleMenu)
  const queryClient = useQueryClient()
  const [ready, setReady] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    async function checkSession() {
      try {
        if (!hasSession() && hasRefreshToken()) await Auth.refresh()
        if (!hasSession()) throw new Error('Missing session')
        const identity = await Auth.me()
        if (!identity.data?.email) throw new Error('Invalid session')
        if (mounted) {
          setIdentity(identity.data.email, identity.data.effectivePermissions || [])
          setReady(true)
        }
      } catch {
        if (!mounted) return
        clearSession()
        clearIdentity()
        queryClient.clear()

        const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
        router.replace(`/login?from=${encodeURIComponent(returnTo)}`)
      }
    }
    void checkSession()
    return () => { mounted = false }
  }, [clearIdentity, pathname, queryClient, router, setIdentity])

  async function signOut() {
    try { await Auth.logout() } catch { /* always leave the protected area */ } finally {
      clearIdentity()
      queryClient.clear()
      router.replace('/login')
    }
  }

  if (!ready) return <main className="page-shell"><div className="empty-state">Checking admin session…</div></main>
  const permissionSet = new Set(permissions)
  return <div className="portal">
    <header className="portal-topbar">
      <Link className="brand" href="/dashboard"><img src="/images/logo.png" alt="Disbux" /><span>Admin</span></Link>
      <button className="nav-toggle" type="button" aria-expanded={menuOpen} aria-controls="portal-nav" onClick={toggleMenu}>
        {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        <span>{menuOpen ? 'Close' : 'Menu'}</span>
      </button>
    </header>
    <aside className={`sidebar${menuOpen ? ' open' : ''}`} id="portal-nav" aria-label="Admin navigation">
      <Link className="brand" href="/dashboard"><img src="/images/logo.png" alt="Disbux" /><span>Admin Portal</span></Link>
      <span className="nav-label">Manage</span>
      {links.filter((link) => permissionSet.has(link.permission)).map(({ to, label, Icon }) => (
        <Link key={to} className="nav-link" href={to} aria-current={pathname === to ? 'page' : undefined}>
          <Icon size={17} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
      <span className="nav-label">Site</span>
      <a className="nav-link" href="https://disbux.com">View website</a>
      <div className="sidebar-footer">
        <span className="account-email">{email}</span>
        <button className="button outline" type="button" onClick={() => void signOut()}>
          <LogOut size={16} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
    <main className="portal-main">
      {permissionSet.has(requiredPermission)
        ? children
        : <section className="panel"><h1>Access unavailable</h1><p className="muted">Your admin role does not grant access to this page.</p></section>}
    </main>
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
