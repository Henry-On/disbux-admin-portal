'use client'

import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AdminLayout, Notice } from '@/components/AdminLayout'
import type { Submission } from '@/services/api'
import { useAnnouncementCount, useKycSubmissions } from '@/services/queries'

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Could not load dashboard.'
}

function dateTime(value: string) {
  return new Date(value).toLocaleString()
}

function DashboardContent() {
  const kycQuery = useKycSubmissions('ALL')
  const announcementsQuery = useAnnouncementCount()
  const submissions = kycQuery.data ?? []
  const pending = submissions.filter((item) => item.status === 'PENDING_REVIEW')
  const approved = submissions.filter((item) => item.status === 'APPROVED').length
  const rejected = submissions.filter((item) => item.status === 'REJECTED').length
  const loading = kycQuery.isLoading || announcementsQuery.isLoading
  const error = kycQuery.isError
    ? messageOf(kycQuery.error)
    : announcementsQuery.isError ? messageOf(announcementsQuery.error) : ''
  const chartData = [
    { status: 'Pending', count: pending.length },
    { status: 'Approved', count: approved },
    { status: 'Rejected', count: rejected },
  ]

  async function refresh() {
    await Promise.all([kycQuery.refetch(), announcementsQuery.refetch()])
  }

  return (
    <div className="portal-content">
      <div className="welcome">
        <div>
          <p className="eyebrow">DISBUX OPERATIONS</p>
          <h1>Dashboard</h1>
          <p className="muted">Everything that needs your attention, at a glance.</p>
        </div>
        <button className="button outline" type="button" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </button>
      </div>
      <Notice message={error} kind="error" />
      {loading ? (
        <div className="empty-state">Loading dashboard…</div>
      ) : error ? null : (
        <>
          <div className="stat-grid" aria-live="polite">
            <Stat label="Pending KYC reviews" value={pending.length} sub={pending.length ? 'needs your review' : 'all caught up'} />
            <Stat label="KYC approved" value={approved} />
            <Stat label="KYC rejected" value={rejected} />
            <Stat
              label="Announcements"
              value={announcementsQuery.data ?? '—'}
              sub={announcementsQuery.data === null ? 'history unavailable' : 'in carousel'}
            />
          </div>
          <section className="panel dashboard-chart">
            <div className="section-heading">
              <div>
                <p className="eyebrow">VERIFICATION</p>
                <h2>KYC status overview</h2>
              </div>
            </div>
            <div className="chart-frame">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} accessibilityLayer>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="status" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6a007f" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel" style={{ marginTop: 18 }}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">WORKLOAD</p>
                <h2>Oldest pending KYC</h2>
              </div>
              <Link className="button outline" href="/kyc">Review all</Link>
            </div>
            {pending.length ? (
              <div className="recent-list">
                {pending.slice(0, 5).map((item) => (
                  <PendingRow item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <div className="empty-state">No pending KYC submissions. Everything is reviewed.</div>
            )}
          </section>
          <section className="panel" style={{ marginTop: 18 }}>
            <div className="section-heading">
              <div>
                <p className="eyebrow">SHORTCUTS</p>
                <h2>Manage the app</h2>
              </div>
            </div>
            <div className="action-grid">
              <Link className="action-card" href="/kyc">
                <h3>Review KYC</h3>
                <p>Approve or reject identity submissions. Approvals verify the user and create their funding account.</p>
              </Link>
              <Link className="action-card" href="/announcements">
                <h3>Post announcement</h3>
                <p>Broadcast to every user: app carousel, notification feed, email and push. Edit or hide carousel slides any time.</p>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function PendingRow({ item }: { item: Submission }) {
  const user = item.user || {}
  const name = [user.firstName, user.otherNames, user.lastName].filter(Boolean).join(' ')
    || user.username || 'Unnamed user'

  return (
    <Link className="recent-row" href="/kyc">
      <span className="recent-name">{name}</span>
      <span className="recent-sub">{user.email || 'no email'} · submitted {dateTime(item.createdAt)}</span>
    </Link>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <AdminLayout requiredPermission="dashboard.view">
      <DashboardContent />
    </AdminLayout>
  )
}
