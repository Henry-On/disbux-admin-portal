import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="page-shell">
      <section className="auth-card">
        <p className="eyebrow">DISBUX ADMIN</p>
        <h1>Page not found</h1>
        <Link className="button primary" href="/dashboard">Go to dashboard</Link>
      </section>
    </main>
  )
}
