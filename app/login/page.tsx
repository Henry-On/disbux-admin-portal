'use client'

import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Notice } from '@/components/AdminLayout'
import { ApiError, Auth, hasRefreshToken, hasSession } from '@/services/api'

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
})

const verificationSchema = z.object({
  code: z.string().regex(/^[0-9]{6}$/, 'Enter the six-digit verification code.'),
})

type LoginFields = z.infer<typeof loginSchema>
type VerificationFields = z.infer<typeof verificationSchema>

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'login' | 'verify'>('login')
  const [email, setEmail] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [notice, setNotice] = useState({
    text: '',
    kind: '' as '' | 'error' | 'success',
  })
  const [busy, setBusy] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const loginForm = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const verificationForm = useForm<VerificationFields>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { code: '' },
  })
  const [returnTo] = useState(() => {
    if (typeof window === 'undefined') return '/dashboard'
    const requested = new URLSearchParams(window.location.search).get('from')
    if (!requested?.startsWith('/')) return '/dashboard'

    try {
      const target = new URL(requested, window.location.origin)
      return target.origin === window.location.origin && target.pathname !== '/login'
        ? `${target.pathname}${target.search}${target.hash}`
        : '/dashboard'
    } catch {
      return '/dashboard'
    }
  })

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      if (!hasSession() && !hasRefreshToken()) return

      try {
        if (hasSession()) await Auth.me()
        else await Auth.refresh()

        if (mounted) router.replace(returnTo)
      } catch {
        // show sign-in form
      }
    }

    void checkSession()

    return () => {
      mounted = false
    }
  }, [router, returnTo])

  useEffect(() => {
    if (countdown <= 0) return

    const timer = window.setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [countdown])

  async function submitLogin(values: LoginFields) {
    setNotice({ text: '', kind: '' })
    setBusy(true)

    try {
      const normalized = values.email.trim().toLowerCase()
      const result = await Auth.login(normalized, values.password)
      const data = result.data || {}

      if (!data.requiresVerification || !data.challengeId) {
        throw new Error('The server returned an invalid verification request.')
      }

      setEmail(data.email || normalized)
      setChallengeId(data.challengeId)
      loginForm.resetField('password')
      verificationForm.reset()
      setStep('verify')
      setCountdown(60)
      setNotice({
        text: result.message || 'Check your email for the sign-in code.',
        kind: 'success',
      })
    } catch (error) {
      setNotice({ text: messageOf(error), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function submitVerification(values: VerificationFields) {
    setNotice({ text: '', kind: '' })
    setBusy(true)

    try {
      const result = await Auth.verify({ email, challengeId, code: values.code.trim() })
      const data = result.data || {}

      if (!data.accessToken || !data.refreshToken || !data.user?.email) {
        throw new ApiError('The server returned an invalid admin session.', 500)
      }

      Auth.storeSession(data)
      router.replace(returnTo)
    } catch (error) {
      setNotice({ text: messageOf(error), kind: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function resendCode() {
    setBusy(true)

    try {
      const result = await Auth.resend({ email, challengeId })
      setNotice({
        text: result.message || 'A new verification code was sent.',
        kind: 'success',
      })
      setCountdown(60)
    } catch (error) {
      const text = messageOf(error)
      setNotice({ text, kind: 'error' })

      if (text.startsWith('Wait ')) {
        setCountdown(Number(text.match(/\d+/)?.[0] || 60))
      }
    } finally {
      setBusy(false)
    }
  }

  function backToLogin() {
    setStep('login')
    verificationForm.reset()
    setChallengeId('')
    setNotice({ text: '', kind: '' })
  }

  return (
    <main className="page-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="brand" href="/login" aria-label="Disbux home">
          <img src="/images/logo.png" alt="Disbux" />
          <span>Admin Portal</span>
        </a>

        {step === 'login' ? (
          <>
            <p className="eyebrow">STAFF ACCESS</p>
            <h1 id="auth-title">Sign in securely</h1>
            <p className="muted">
              Use your admin email and account password. We’ll email you a one-time
              verification code.
            </p>

            <form className="form-stack" onSubmit={loginForm.handleSubmit(submitLogin)}>
              <label htmlFor="admin-email">Email address</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                required
                {...loginForm.register('email')}
              />
              {loginForm.formState.errors.email && <span className="field-error">{loginForm.formState.errors.email.message}</span>}

              <p className="login-hint">
                Sign in with your admin email. Access is controlled by the backend’s
                ADMIN_EMAILS allow-list — only whitelisted addresses can sign in.
              </p>

              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                {...loginForm.register('password')}
              />
              {loginForm.formState.errors.password && <span className="field-error">{loginForm.formState.errors.password.message}</span>}

              <button className="button primary full" type="submit" disabled={busy}>
                {busy ? 'Checking credentials…' : 'Continue'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="eyebrow">TWO-STEP VERIFICATION</p>
            <h1 id="auth-title">Check your email</h1>
            <p className="muted">
              Enter the six-digit code sent to <strong>{email}</strong>.
            </p>

            <form className="form-stack" onSubmit={verificationForm.handleSubmit(submitVerification)}>
              <label htmlFor="verify-code">Verification code</label>
              <input
                id="verify-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                {...verificationForm.register('code')}
              />
              {verificationForm.formState.errors.code && <span className="field-error">{verificationForm.formState.errors.code.message}</span>}

              <button className="button primary full" type="submit" disabled={busy}>
                {busy ? 'Verifying…' : 'Verify and sign in'}
              </button>
            </form>

            <button
              className="text-button"
              type="button"
              disabled={busy || countdown > 0}
              onClick={() => void resendCode()}
            >
              {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
            </button>

            <button className="text-button secondary" type="button" onClick={backToLogin}>
              Back to sign in
            </button>
          </>
        )}

        <Notice message={notice.text} kind={notice.kind} />

        <p className="security-note">
          Admin access is restricted to approved admin accounts. Sign-in here does not
          sign you out of the mobile app.
        </p>
      </section>
    </main>
  )
}
