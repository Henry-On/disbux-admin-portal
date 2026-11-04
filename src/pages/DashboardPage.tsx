import { useCallback, useEffect, useState } from 'react'
import { Link } from '../services/router'
import { Announcements, ApiError, Kyc, type Submission } from '../services/api'
import { Notice } from '../components/AdminLayout'

function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Could not load dashboard.' }
function dateTime(value: string) { return new Date(value).toLocaleString() }

export function DashboardPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [announcementCount, setAnnouncementCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [kyc, announcements] = await Promise.all([
        Kyc.list('ALL'),
        Announcements.list().then((response) => Array.isArray(response.data) ? response.data.length : 0).catch((reason: unknown) => {
          if (reason instanceof ApiError && [404, 405].includes(reason.status)) return null
          throw reason
        }),
      ])
      setSubmissions(Array.isArray(kyc.data) ? kyc.data : []); setAnnouncementCount(announcements)
    } catch (reason) { setError(messageOf(reason)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  const pending = submissions.filter((item) => item.status === 'PENDING_REVIEW')
  const approved = submissions.filter((item) => item.status === 'APPROVED').length
  const rejected = submissions.filter((item) => item.status === 'REJECTED').length

  return <div className="portal-content">
    <div className="welcome"><div><p className="eyebrow">DISBUX OPERATIONS</p><h1>Dashboard</h1><p className="muted">Everything that needs your attention, at a glance.</p></div><button className="button outline" type="button" onClick={() => void load()} disabled={loading}>Refresh</button></div>
    <Notice message={error} kind="error" />
    <div className="stat-grid" aria-live="polite">
      {loading ? <div className="empty-state">Loading…</div> : <>
        <Stat label="Pending KYC reviews" value={pending.length} sub={pending.length ? 'needs your review' : 'all caught up'} />
        <Stat label="KYC approved" value={approved} /><Stat label="KYC rejected" value={rejected} />
        <Stat label="Announcements" value={announcementCount === null ? '—' : announcementCount} sub={announcementCount === null ? 'history unavailable' : 'in carousel'} />
      </>}
    </div>
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">WORKLOAD</p><h2>Oldest pending KYC</h2></div><Link className="button outline" to="/kyc">Review all</Link></div>
      {loading ? <div className="empty-state">Loading…</div> : pending.length ? <div className="recent-list">{pending.slice(0, 5).map((item) => {
        const user = item.user || {}; const name = [user.firstName, user.otherNames, user.lastName].filter(Boolean).join(' ') || user.username || 'Unnamed user'
        return <Link className="recent-row" to="/kyc" key={item.id}><span className="recent-name">{name}</span><span className="recent-sub">{user.email || 'no email'} · submitted {dateTime(item.createdAt)}</span></Link>
      })}</div> : <div className="empty-state">No pending KYC submissions. Everything is reviewed.</div>}
    </section>
    <section className="panel" style={{ marginTop: 18 }}><div className="section-heading"><div><p className="eyebrow">SHORTCUTS</p><h2>Manage the app</h2></div></div><div className="action-grid">
      <Link className="action-card" to="/kyc"><h3>Review KYC</h3><p>Approve or reject identity submissions. Approvals verify the user and create their funding account.</p></Link>
      <Link className="action-card" to="/announcements"><h3>Post announcement</h3><p>Broadcast to every user: app carousel, notification feed, email and push. Edit or hide carousel slides any time.</p></Link>
    </div></section>
  </div>
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return <div className="stat-card"><span className="stat-label">{label}</span><span className="stat-value">{value}</span>{sub && <span className="stat-sub">{sub}</span>}</div>
}
