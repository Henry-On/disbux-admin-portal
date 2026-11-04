import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Modal, Notice } from '../components/AdminLayout'
import { Kyc, type Submission } from '../services/api'

function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.' }
function dateTime(value: string) { return new Date(value).toLocaleString() }
function fullName(user: NonNullable<Submission['user']>) {
  return [user.firstName, user.otherNames, user.lastName].filter(Boolean).join(' ') || user.username || 'Unnamed user'
}

export function KycPage() {
  const [filter, setFilter] = useState('PENDING_REVIEW')
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState({ text: '', kind: '' as '' | 'error' | 'success' })
  const [photoId, setPhotoId] = useState('')
  const [photos, setPhotos] = useState<{ label: string; url: string }[]>([])
  const [photoError, setPhotoError] = useState('')
  const [reviewTarget, setReviewTarget] = useState('')
  const [reason, setReason] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setNotice({ text: '', kind: '' })
    try {
      const response = await Kyc.list(filter)
      setSubmissions(Array.isArray(response.data) ? response.data : [])
    } catch (error) { setSubmissions([]); setNotice({ text: messageOf(error), kind: 'error' }) }
    finally { setLoading(false) }
  }, [filter])
  useEffect(() => { void load() }, [load])

  async function openPhotos(id: string) {
    setPhotoId(id); setPhotos([]); setPhotoError('')
    try {
      const [selfie, idPhoto] = await Promise.all([Kyc.photo(id, 'selfie'), Kyc.photo(id, 'idPhoto')])
      const items = [{ label: 'Selfie', url: selfie.data?.url || '' }, { label: 'Identity document', url: idPhoto.data?.url || '' }]
      const invalid = items.some(({ url }) => {
        try { const parsed = new URL(url); return parsed.protocol !== 'https:' || parsed.hostname !== 'api.cloudinary.com' }
        catch { return true }
      })
      if (invalid) throw new Error('The server returned an invalid private image link.')
      setPhotos(items)
    } catch (error) { setPhotoError(messageOf(error)) }
  }

  async function review(id: string, decision: 'APPROVED' | 'REJECTED', rejectionReason = '') {
    setSaving(true); setNotice({ text: '', kind: '' })
    try {
      const result = await Kyc.review(id, decision, rejectionReason)
      setReviewTarget('')
      setNotice({ text: result.message || `KYC ${decision.toLowerCase()} successfully.`, kind: 'success' })
      await load()
    } catch (error) {
      if (decision === 'REJECTED') setReviewError(messageOf(error))
      else setNotice({ text: messageOf(error), kind: 'error' })
    } finally { setSaving(false) }
  }

  function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (reason.trim().length < 5) { setReviewError('Enter a rejection reason of at least 5 characters.'); return }
    void review(reviewTarget, 'REJECTED', reason.trim())
  }

  return <div className="portal-content">
    <div className="welcome"><div><p className="eyebrow">IDENTITY VERIFICATION</p><h1>KYC submissions</h1><p className="muted">Approving verifies the user and creates their funding account. Rejections need a reason.</p></div></div>
    <section className="panel"><div className="section-heading"><div><p className="eyebrow">QUEUE</p><h2>Submissions</h2></div><div className="toolbar"><label className="sr-only" htmlFor="kyc-filter">Submission status</label><select id="kyc-filter" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="PENDING_REVIEW">Pending review</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="ALL">All submissions</option></select><button className="button outline" type="button" onClick={() => void load()} disabled={loading}>Refresh</button></div></div>
      <Notice message={notice.text} kind={notice.kind} />
      <div className="submission-list" aria-live="polite">{loading ? <div className="empty-state">Loading KYC submissions…</div> : submissions.length === 0 ? <div className="empty-state">No submissions found for this status.</div> : submissions.map((submission) => <SubmissionCard key={submission.id} submission={submission} onPhotos={() => void openPhotos(submission.id)} onApprove={() => { if (window.confirm('Approve this KYC submission? The user will be verified and may receive a funding account.')) void review(submission.id, 'APPROVED') }} onReject={() => { setReviewTarget(submission.id); setReason(''); setReviewError('') }} />)}</div>
    </section>
    {photoId && <Modal title="KYC photos" eyebrow="PRIVATE IDENTITY DOCUMENTS" wide onClose={() => setPhotoId('')}><Notice message={photoError} kind="error" /><div className="photo-grid">{photos.map((photo) => <div key={photo.label}><p className="photo-label">{photo.label}</p><div className="photo-frame"><img src={photo.url} alt={photo.label} referrerPolicy="no-referrer" /></div></div>)}</div><p className="muted small">These private links expire after five minutes. Close this window when you’re done reviewing.</p></Modal>}
    {reviewTarget && <Modal title="Reject submission" eyebrow="KYC REVIEW" onClose={() => setReviewTarget('')}><form className="form-stack" onSubmit={reject}><label htmlFor="rejection-reason">Reason (5–500 characters)</label><textarea id="rejection-reason" minLength={5} maxLength={500} rows={4} required value={reason} onChange={(event) => setReason(event.target.value)} /><div className="form-footer"><button className="button outline" type="button" onClick={() => setReviewTarget('')}>Cancel</button><button className="button danger" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Reject KYC'}</button></div></form><Notice message={reviewError} kind="error" /></Modal>}
  </div>
}

function SubmissionCard({ submission, onPhotos, onApprove, onReject }: { submission: Submission; onPhotos: () => void; onApprove: () => void; onReject: () => void }) {
  const user = submission.user || {}
  const statusClass = submission.status === 'APPROVED' ? 'approved' : submission.status === 'REJECTED' ? 'rejected' : ''
  return <article className="submission"><div className="submission-head"><div><h3 className="submission-name">{fullName(user)}</h3><p className="submission-sub">{user.email || 'no email'} · {user.phoneNumber || 'No phone number'} · Submitted {dateTime(submission.createdAt)}</p></div><span className={`badge ${statusClass}`}>{submission.status.replaceAll('_', ' ')}</span></div>
    <div className="submission-details"><Detail label="Username" value={user.username} /><Detail label="Date of birth" value={user.DOB} /><Detail label="Account type" value={user.accountType} /><Detail label="NIN" value={user.NIN} /><Detail label="BVN" value={user.BVN} />{submission.rejectionReason && <Detail label="Rejection reason" value={submission.rejectionReason} />}</div>
    {submission.status === 'PENDING_REVIEW' && <div className="submission-actions"><button className="button outline" type="button" onClick={onPhotos}>View private photos</button><button className="button success" type="button" onClick={onApprove}>Approve</button><button className="button danger" type="button" onClick={onReject}>Reject</button></div>}
  </article>
}

function Detail({ label, value }: { label: string; value?: string }) { return <div><span className="detail-label">{label}</span><span className="detail-value">{value || '—'}</span></div> }
