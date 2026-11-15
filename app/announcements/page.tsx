'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { Edit3, Eye, EyeOff, RefreshCw, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { AdminLayout, Modal, Notice } from '@/components/AdminLayout'
import { useAdminStore } from '@/stores/adminStore'
import { Announcements, ApiError, type Announcement } from '@/services/api'
import { queryKeys, useAnnouncementHistory } from '@/services/queries'

const MAX_BODY = 2000
const NOT_AVAILABLE =
  'That action isn’t available on the server yet. Ask the backend team to implement the announcement management endpoints in ADMIN_API_CONTRACT.md.'
const announcementSchema = z.object({
  title: z.string().trim().min(3, 'Enter a title of at least 3 characters.').max(100),
  body: z.string().trim().min(3, 'Enter a message of at least 3 characters.').max(MAX_BODY),
})

type AnnouncementFields = z.infer<typeof announcementSchema>

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function dateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : '—'
}

function missingEndpoint(error: unknown) {
  return error instanceof ApiError && [404, 405].includes(error.status)
}

function AnnouncementsContent() {
  const permissions = useAdminStore((state) => state.permissions)
  const [notice, setNotice] = useState({
    text: '',
    kind: '' as '' | 'error' | 'success',
  })
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [editError, setEditError] = useState('')
  const queryClient = useQueryClient()
  const historyQuery = useAnnouncementHistory()
  const history = historyQuery.data ?? []
  const historyState = historyQuery.isLoading
    ? 'loading'
    : historyQuery.isError
      ? missingEndpoint(historyQuery.error) ? 'unavailable' : 'error'
      : 'ready'
  const publishForm = useForm<AnnouncementFields>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', body: '' },
  })
  const editForm = useForm<AnnouncementFields>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', body: '' },
  })
  const publishBody = useWatch({ control: publishForm.control, name: 'body' }) || ''
  const publishMutation = useMutation({ mutationFn: Announcements.publish })
  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Announcement, 'title' | 'body' | 'active'>> }) =>
      Announcements.update(id, patch),
  })
  const removeMutation = useMutation({ mutationFn: Announcements.remove })
  const busy = publishMutation.isPending || updateMutation.isPending || removeMutation.isPending

  async function publish(values: AnnouncementFields) {
    setNotice({ text: '', kind: '' })
    if (
      !window.confirm(
        'Publish this announcement to all users? It will appear in the app carousel and notification feed, and be sent by email and push where available.'
      )
    ) {
      return
    }

    try {
      const response = await publishMutation.mutateAsync(values)
      const result = response.data || {}

      setNotice({
        text: `Published to ${result.recipients ?? 0} users. Email: ${result.emailsSent ?? 0} sent, ${result.emailsFailed ?? 0} failed. Push: ${result.pushesSent ?? 0} sent, ${result.pushesFailed ?? 0} failed.`,
        kind: 'success',
      })

      publishForm.reset({ title: '', body: '' })
      await queryClient.invalidateQueries({ queryKey: queryKeys.announcementList })
    } catch (error) {
      setNotice({ text: messageOf(error), kind: 'error' })
    }
  }

  function edit(item: Announcement) {
    setEditing(item)
    setEditError('')
    editForm.reset({ title: item.title || '', body: item.body || '' })
  }

  async function saveEdit(values: AnnouncementFields) {
    if (!editing) return

    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        patch: { title: values.title, body: values.body },
      })

      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.announcementList })
    } catch (error) {
      setEditError(missingEndpoint(error) ? NOT_AVAILABLE : messageOf(error))
    }
  }

  async function toggle(item: Announcement) {
    try {
      await updateMutation.mutateAsync({ id: item.id, patch: { active: item.active === false } })
      await queryClient.invalidateQueries({ queryKey: queryKeys.announcementList })
    } catch (error) {
      window.alert(missingEndpoint(error) ? NOT_AVAILABLE : messageOf(error))
    }
  }

  async function remove(item: Announcement) {
    if (
      !window.confirm(
        'Delete this announcement? It disappears from the carousel. Already-sent emails and notifications are not recalled.'
      )
    ) {
      return
    }

    try {
      await removeMutation.mutateAsync(item.id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.announcementList })
    } catch (error) {
      window.alert(missingEndpoint(error) ? NOT_AVAILABLE : messageOf(error))
    }
  }

  return (
    <div className="portal-content">
      <div className="welcome">
        <div>
          <p className="eyebrow">CAROUSEL &amp; BROADCASTS</p>
          <h1>Announcements</h1>
          <p className="muted">
            Post announcements and giveaway promos to the app’s dashboard carousel.
            Publishing broadcasts to every user (carousel, notification feed, email,
            push). Edits below only change the carousel text — already-sent emails and
            notifications stay as they were.
          </p>
        </div>
      </div>

      {permissions.includes('announcements.create') && <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BROADCAST</p>
            <h2>Post an announcement</h2>
          </div>
        </div>

        <form
          className="form-stack announcement-form"
          onSubmit={publishForm.handleSubmit(publish)}
        >
          <label htmlFor="announcement-title">Title (3–100 characters)</label>
          <input
            id="announcement-title"
            maxLength={100}
            {...publishForm.register('title')}
          />
          {publishForm.formState.errors.title && <span className="field-error">{publishForm.formState.errors.title.message}</span>}

          <label htmlFor="announcement-body">Message (3–2000 characters)</label>
          <textarea
            id="announcement-body"
            maxLength={MAX_BODY}
            rows={6}
            {...publishForm.register('body')}
          />
          {publishForm.formState.errors.body && <span className="field-error">{publishForm.formState.errors.body.message}</span>}

          <div className="form-footer">
            <span className="muted">
              {publishBody.length} / {MAX_BODY}
            </span>
            <button className="button primary" type="submit" disabled={busy}>
              {busy ? 'Publishing…' : 'Publish announcement'}
            </button>
          </div>
        </form>

        <Notice message={notice.text} kind={notice.kind} />
      </section>}

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">MANAGE</p>
            <h2>Carousel announcements</h2>
          </div>
          <button
            className="button outline"
            type="button"
            onClick={() => void historyQuery.refetch()}
            disabled={historyState === 'loading'}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <p className="muted announcement-help">
          Edit the text, hide a slide from the carousel, or delete it. Changes apply to
          the carousel immediately on the next app refresh.
        </p>

        <div className="history-list" aria-live="polite">
          {historyState === 'loading' ? (
            <div className="empty-state">Loading…</div>
          ) : historyState === 'unavailable' ? (
            <div className="empty-state">
              Management isn’t available: the backend doesn’t expose an announcement
              list yet. Publishing above still works.
            </div>
          ) : historyState === 'error' ? (
            <div className="empty-state">
              Couldn’t load announcements: {messageOf(historyQuery.error)}
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              No announcements yet. Published ones will appear here for editing.
            </div>
          ) : (
            history.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                busy={busy}
                onEdit={() => edit(item)}
                onToggle={() => void toggle(item)}
                onDelete={() => void remove(item)}
                canUpdate={permissions.includes('announcements.update')}
                canDelete={permissions.includes('announcements.delete')}
              />
            ))
          )}
        </div>
      </section>

      {editing && (
        <Modal title="Edit announcement" eyebrow="CAROUSEL" onClose={() => setEditing(null)}>
          <form className="form-stack" onSubmit={editForm.handleSubmit(saveEdit)}>
            <label htmlFor="edit-title">Title (3–100 characters)</label>
            <input
              id="edit-title"
              maxLength={100}
              {...editForm.register('title')}
            />
            {editForm.formState.errors.title && <span className="field-error">{editForm.formState.errors.title.message}</span>}

            <label htmlFor="edit-body">Message (3–2000 characters)</label>
            <textarea
              id="edit-body"
              maxLength={MAX_BODY}
              rows={6}
              {...editForm.register('body')}
            />
            {editForm.formState.errors.body && <span className="field-error">{editForm.formState.errors.body.message}</span>}

            <div className="form-footer">
              <button className="button outline" type="button" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </button>
              <button className="button primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>

          <Notice message={editError} kind="error" />
          <p className="muted small">
            Saving updates the carousel only. It does not resend email or push
            notifications.
          </p>
        </Modal>
      )}
    </div>
  )
}

export default function AnnouncementsPage() {
  return (
    <AdminLayout requiredPermission="announcements.view">
      <AnnouncementsContent />
    </AdminLayout>
  )
}

function HistoryCard({
  item,
  busy,
  onEdit,
  onToggle,
  onDelete,
  canUpdate,
  canDelete,
}: {
  item: Announcement
  busy: boolean
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  canUpdate: boolean
  canDelete: boolean
}) {
  const active = item.active !== false

  return (
    <article className={`history-row${active ? '' : ' inactive'}`}>
      <div>
        <h3 className="history-title">{item.title || '(untitled)'}</h3>
        <p className="history-body">{item.body || ''}</p>
        <p className="history-meta">
          {active ? 'Visible in carousel' : 'Hidden from carousel'} · {dateTime(item.createdAt)}
        </p>

        <div className="submission-actions">
          {canUpdate && <button className="button outline" type="button" onClick={onEdit} disabled={busy}>
            <Edit3 size={15} aria-hidden="true" />
            Edit
          </button>}
          {canUpdate && <button className="button outline" type="button" onClick={onToggle} disabled={busy}>
            {active ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            {active ? 'Hide' : 'Show'}
          </button>}
          {canDelete && <button className="button danger" type="button" onClick={onDelete} disabled={busy}>
            <Trash2 size={15} aria-hidden="true" />
            Delete
          </button>}
        </div>
      </div>
    </article>
  )
}

