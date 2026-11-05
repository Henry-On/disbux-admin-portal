import { useEffect, useState, type FormEvent } from 'react'
import { Notice } from '../components/AdminLayout'
import { ApiError, Auth, hasRefreshToken, hasSession } from '../services/api'
import { useLocation, useNavigate } from 'react-router'

function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.' }

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [step, setStep] = useState<'login' | 'verify'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [notice, setNotice] = useState({ text: '', kind: '' as '' | 'error' | 'success' })
  const [busy, setBusy] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const returnTo = (location.state as { from?: { pathname: string; search: string; hash: string } } | null)?.from || '/dashboard'

  useEffect(() => {
    let mounted = true
    async function checkSession() {
      if (!hasSession() && !hasRefreshToken()) return
      try {
        if (hasSession()) await Auth.me()
        else await Auth.refresh()
        if (mounted) navigate(returnTo, { replace: true })
      } catch { /* show sign-in form */ }
    }
    void checkSession()
    return () => { mounted = false }
  }, [navigate, returnTo])

  useEffect(() => {
    if (countdown <= 0) return
    const timer = window.setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [countdown])

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice({ text: '', kind: '' }); setBusy(true)
    try {
      const normalized = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Enter a valid email address.')
      const result = await Auth.login(normalized, password)
      const data = result.data || {}
      if (!data.requiresVerification || !data.challengeId) throw new Error('The server returned an invalid verification request.')
      setEmail(data.email || normalized); setChallengeId(data.challengeId); setPassword(''); setStep('verify'); setCountdown(60)
      setNotice({ text: result.message || 'Check your email for the sign-in code.', kind: 'success' })
    } catch (error) { setNotice({ text: messageOf(error), kind: 'error' }) }
    finally { setBusy(false) }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice({ text: '', kind: '' }); setBusy(true)
    try {
      const result = await Auth.verify({ email, challengeId, code: code.trim() })
      const data = result.data || {}
      if (!data.accessToken || !data.refreshToken || !data.user?.email) throw new ApiError('The server returned an invalid admin session.', 500)
      Auth.storeSession(data); navigate(returnTo, { replace: true })
    } catch (error) { setNotice({ text: messageOf(error), kind: 'error' }) }
    finally { setBusy(false) }
  }

  async function resendCode() {
    setBusy(true)
    try {
      const result = await Auth.resend({ email, challengeId })
      setNotice({ text: result.message || 'A new verification code was sent.', kind: 'success' }); setCountdown(60)
    } catch (error) {
      const text = messageOf(error); setNotice({ text, kind: 'error' })
      if (text.startsWith('Wait ')) setCountdown(Number(text.match(/\d+/)?.[0] || 60))
    } finally { setBusy(false) }
  }

  function backToLogin() {
    setStep('login'); setCode(''); setChallengeId(''); setNotice({ text: '', kind: '' })
  }

  return <main className="page-shell"><section className="auth-card" aria-labelledby="auth-title">
    <a className="brand" href="/login" aria-label="Disbux home"><img src="/images/logo.png" alt="Disbux" /><span>Admin Portal</span></a>
    {step === 'login' ? <>
      <p className="eyebrow">STAFF ACCESS</p><h1 id="auth-title">Sign in securely</h1>
      <p className="muted">Use your admin email and account password. We’ll email you a one-time verification code.</p>
      <form className="form-stack" onSubmit={(event) => void submitLogin(event)}>
        <label htmlFor="admin-email">Email address</label><input id="admin-email" type="email" autoComplete="username" placeholder="you@example.com" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <p className="login-hint">Sign in with your admin email. Access is controlled by the backend’s ADMIN_EMAILS allow-list — only whitelisted addresses can sign in.</p>
        <label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="button primary full" type="submit" disabled={busy}>{busy ? 'Checking credentials…' : 'Continue'}</button>
      </form>
    </> : <>
      <p className="eyebrow">TWO-STEP VERIFICATION</p><h1 id="auth-title">Check your email</h1>
      <p className="muted">Enter the six-digit code sent to <strong>{email}</strong>.</p>
      <form className="form-stack" onSubmit={(event) => void submitVerification(event)}>
        <label htmlFor="verify-code">Verification code</label><input id="verify-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value)} />
        <button className="button primary full" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify and sign in'}</button>
      </form>
      <button className="text-button" type="button" disabled={busy || countdown > 0} onClick={() => void resendCode()}>{countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}</button>
      <button className="text-button secondary" type="button" onClick={backToLogin}>Back to sign in</button>
    </>}
    <Notice message={notice.text} kind={notice.kind} />
    <p className="security-note">Admin access is restricted to approved admin accounts. Sign-in here does not sign you out of the mobile app.</p>
  </section></main>
}
