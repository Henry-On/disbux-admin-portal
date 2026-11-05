import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Modal, Notice } from '../components/AdminLayout'
import { Announcements, ApiError, type Announcement } from '../services/api'

const MAX_BODY = 2000
const NOT_AVAILABLE = 'That action isn’t available on the server yet. Ask the backend team to implement the announcement management endpoints in ADMIN_API_CONTRACT.md.'
function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.' }
function dateTime(value?: string) { return value ? new Date(value).toLocaleString() : '—' }
function missingEndpoint(error: unknown) { return error instanceof ApiError && [404, 405].includes(error.status) }

export function AnnouncementsPage() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [history, setHistory] = useState<Announcement[]>([])
  const [historyState, setHistoryState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading')
  const [historyError, setHistoryError] = useState('')
  const [notice, setNotice] = useState({ text: '', kind: '' as '' | 'error' | 'success' })
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editError, setEditError] = useState('')

  const loadHistory = useCallback(async () => {
    setHistoryState('loading'); setHistoryError('')
    try {
      const response = await Announcements.list()
      setHistory(Array.isArray(response.data) ? response.data.slice(0, 20) : []); setHistoryState('ready')
    } catch (error) {
      if (missingEndpoint(error)) setHistoryState('unavailable')
      else { setHistoryError(messageOf(error)); setHistoryState('error') }
    }
  }, [])
  useEffect(() => { void loadHistory() }, [loadHistory])

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice({ text: '', kind: '' })
    const cleanTitle = title.trim();

    const cleanBody = body.trim()
    if (cleanTitle.length < 3 || cleanBody.length < 3) {
      setNotice({ text: 'Enter a title and message of at least 3 characters.', kind: 'error' });
      return
    }
    if (!window.confirm('Publish this announcement to all users? It will appear in the app carousel and notification feed, and be sent by email and push where available.')) return

    setBusy(true)

    try {
      const response = await Announcements.publish({ title: cleanTitle, body: cleanBody })
      const result = response.data || {}

      setNotice({ text: `Published to ${result.recipients ?? 0} users. Email: ${result.emailsSent ?? 0} sent, ${result.emailsFailed ?? 0} failed. Push: ${result.pushesSent ?? 0} sent, ${result.pushesFailed ?? 0} failed.`, kind: 'success' })

      setTitle('');
      setBody('');
      await loadHistory()

    } catch (error) {
      setNotice({ text: messageOf(error), kind: 'error' })
    }
    finally { setBusy(false) }
  }

  function edit(item: Announcement) { setEditing(item); setEditTitle(item.title || ''); setEditBody(item.body || ''); setEditError('') }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editTitle.trim().length < 3 || editBody.trim().length < 3) { setEditError('Enter a title and message of at least 3 characters.'); return }
    if (!editing) return
    setBusy(true)
    try { await Announcements.update(editing.id, { title: editTitle.trim(), body: editBody.trim() }); setEditing(null); await loadHistory() }
    catch (error) { setEditError(missingEndpoint(error) ? NOT_AVAILABLE : messageOf(error)) }
    finally { setBusy(false) }
  }

  async function toggle(item: Announcement) {
    setBusy(true)
    try { await Announcements.update(item.id, { active: item.active === false }); await loadHistory() }
    catch (error) { window.alert(missingEndpoint(error) ? NOT_AVAILABLE : messageOf(error)) }
    finally { setBusy(false) }
  }

  async function remove(item: Announcement) {
    if (!window.confirm('Delete this announcement? It disappears from the carousel. Already-sent emails and notifications are not recalled.')) return
    setBusy(true)
    try { await Announcements.remove(item.id); await loadHistory() }
    catch (error) { window.alert(missingEndpoint(error) ? NOT_AVAILABLE : messageOf(error)) }
    finally { setBusy(false) }
  }

  return <div className="portal-content">
    <div className="welcome"><div><p className="eyebrow">CAROUSEL &amp; BROADCASTS</p><h1>Announcements</h1><p className="muted">Post announcements and giveaway promos to the app’s dashboard carousel. Publishing broadcasts to every user (carousel, notification feed, email, push). Edits below only change the carousel text — already-sent emails and notifications stay as they were.</p></div></div>
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">BROADCAST</p><h2>Post an announcement</h2></div></div>
      <form className="form-stack announcement-form" onSubmit={(event) => void publish(event)}><label htmlFor="announcement-title">Title (3–100 characters)</label><input id="announcement-title" minLength={3} maxLength={100} required value={title} onChange={(event) => setTitle(event.target.value)} /><label htmlFor="announcement-body">Message (3–2000 characters)</label><textarea id="announcement-body" minLength={3} maxLength={MAX_BODY} rows={6} required value={body} onChange={(event) => setBody(event.target.value)} /><div className="form-footer"><span className="muted">{body.length} / {MAX_BODY}</span><button className="button primary" type="submit" disabled={busy}>{busy ? 'Publishing…' : 'Publish announcement'}</button></div></form>
      <Notice message={notice.text} kind={notice.kind} />
    </section>
    <section className="panel" style={{ marginTop: 18 }}><div className="section-heading"><div><p className="eyebrow">MANAGE</p><h2>Carousel announcements</h2></div><button className="button outline" type="button" onClick={() => void loadHistory()} disabled={historyState === 'loading'}>Refresh</button></div>
      <p className="muted announcement-help">Edit the text, hide a slide from the carousel, or delete it. Changes apply to the carousel immediately on the next app refresh.</p>
      <div className="history-list" aria-live="polite">{historyState === 'loading' ? <div className="empty-state">Loading…</div> : historyState === 'unavailable' ? <div className="empty-state">Management isn’t available: the backend doesn’t expose an announcement list yet. Publishing above still works.</div> : historyState === 'error' ? <div className="empty-state">Couldn’t load announcements: {historyError}</div> : history.length === 0 ? <div className="empty-state">No announcements yet. Published ones will appear here for editing.</div> : history.map((item) => <HistoryCard key={item.id} item={item} busy={busy} onEdit={() => edit(item)} onToggle={() => void toggle(item)} onDelete={() => void remove(item)} />)}</div>
    </section>
    {editing && <Modal title="Edit announcement" eyebrow="CAROUSEL" onClose={() => setEditing(null)}><form className="form-stack" onSubmit={(event) => void saveEdit(event)}><label htmlFor="edit-title">Title (3–100 characters)</label><input id="edit-title" minLength={3} maxLength={100} required value={editTitle} onChange={(event) => setEditTitle(event.target.value)} /><label htmlFor="edit-body">Message (3–2000 characters)</label><textarea id="edit-body" minLength={3} maxLength={MAX_BODY} rows={6} required value={editBody} onChange={(event) => setEditBody(event.target.value)} /><div className="form-footer"><button className="button outline" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div></form><Notice message={editError} kind="error" /><p className="muted small">Saving updates the carousel only. It does not resend email or push notifications.</p></Modal>}
  </div>
}

function HistoryCard({ item, busy, onEdit, onToggle, onDelete }: { item: Announcement; busy: boolean; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const active = item.active !== false
  return <article className={`history-row${active ? '' : ' inactive'}`}><div><h3 className="history-title">{item.title || '(untitled)'}</h3><p className="history-body">{item.body || ''}</p><p className="history-meta">{active ? 'Visible in carousel' : 'Hidden from carousel'} · {dateTime(item.createdAt)}</p><div className="submission-actions"><button className="button outline" type="button" onClick={onEdit} disabled={busy}>Edit</button><button className="button outline" type="button" onClick={onToggle} disabled={busy}>{active ? 'Hide' : 'Show'}</button><button className="button danger" type="button" onClick={onDelete} disabled={busy}>Delete</button></div></div></article>
}
