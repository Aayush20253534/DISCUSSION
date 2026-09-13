import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { signupSchema, loginSchema } from '@atlasborn/shared'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField from '../components/FormField.jsx'
import { useAuth } from '../auth/useAuth.js'
import { readRememberedEmail, saveRememberedEmail } from '../lib/preferences.js'

const emptyOtp = () => Array(6).fill('')

export default function Authenticate({ signup = false }) {
  const auth = useAuth()
  const location = useLocation()
  const form = useRef(null)
  const otpInputs = useRef([])
  const [pending, setPending] = useState(false)
  const [resending, setResending] = useState(false)
  const [fields, setFields] = useState({})
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState('error')
  const [rememberedEmail] = useState(readRememberedEmail)
  const [remember, setRemember] = useState(Boolean(rememberedEmail))
  const [verification, setVerification] = useState(null)
  const [otp, setOtp] = useState(emptyOtp)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (!verification) return undefined
    const timer = window.setInterval(() => {
      setResendIn((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [verification])

  useEffect(() => {
    if (!verification) return undefined
    const timer = window.setTimeout(() => otpInputs.current[0]?.focus(), 80)
    return () => window.clearTimeout(timer)
  }, [verification])

  function resetMessages() {
    setMessage('')
    setMessageKind('error')
  }

  async function submit(event) {
    event.preventDefault()
    if (pending) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const validation = (signup ? signupSchema : loginSchema).safeParse(values)
    const errors = {}
    if (!validation.success) {
      for (const issue of validation.error.issues)
        if (!errors[issue.path[0]]) errors[issue.path[0]] = issue.message
      setFields(errors)
      setMessageKind('error')
      setMessage('Please check the highlighted fields.')
      form.current.elements.namedItem(Object.keys(errors)[0])?.focus()
      return
    }
    setPending(true)
    resetMessages()
    setFields({})
    try {
      if (signup) {
        const result = await auth.signup(validation.data)
        setVerification(result.verification)
        setResendIn(result.verification.resendAfterSeconds || 60)
        setOtp(emptyOtp())
      } else {
        await auth.login(validation.data)
        saveRememberedEmail(validation.data.email, remember)
      }
    } catch (error) {
      setMessageKind('error')
      setMessage(error.message)
      setFields(error.fields || {})
      form.current?.elements.namedItem(Object.keys(error.fields || {})[0])?.focus()
    } finally {
      setPending(false)
    }
  }

  function fillOtp(value, start = 0) {
    const digits = value.replace(/\D/g, '').slice(0, 6 - start)
    if (!digits) return
    setOtp((previous) => {
      const next = [...previous]
      digits.split('').forEach((digit, offset) => {
        next[start + offset] = digit
      })
      return next
    })
    resetMessages()
    const target = Math.min(5, start + digits.length)
    window.requestAnimationFrame(() => otpInputs.current[target]?.focus())
  }

  function updateOtp(index, value) {
    if (value.length > 1) {
      fillOtp(value, index)
      return
    }
    const digit = value.replace(/\D/g, '').slice(-1)
    setOtp((previous) => {
      const next = [...previous]
      next[index] = digit
      return next
    })
    resetMessages()
    if (digit && index < 5) otpInputs.current[index + 1]?.focus()
  }

  async function verify(event) {
    event.preventDefault()
    if (pending || !verification) return
    const code = otp.join('')
    if (!/^\d{6}$/.test(code)) {
      setFields({ otp: 'Enter all 6 digits from the email.' })
      setMessageKind('error')
      setMessage('The verification code is incomplete.')
      otpInputs.current[otp.findIndex((digit) => !digit) === -1 ? 0 : otp.findIndex((digit) => !digit)]?.focus()
      return
    }
    setPending(true)
    resetMessages()
    setFields({})
    try {
      await auth.verifyEmail({ verificationId: verification.id, otp: code })
    } catch (error) {
      setMessageKind('error')
      setMessage(error.message)
      setFields(error.fields || {})
      setOtp(emptyOtp())
      if (['VERIFICATION_EXPIRED', 'OTP_ATTEMPTS_EXCEEDED'].includes(error.code)) {
        setVerification(null)
        return
      }
      window.requestAnimationFrame(() => otpInputs.current[0]?.focus())
    } finally {
      setPending(false)
    }
  }

  async function resend() {
    if (resending || resendIn > 0 || !verification) return
    setResending(true)
    resetMessages()
    try {
      const result = await auth.resendVerification({ verificationId: verification.id })
      setVerification(result.verification)
      setResendIn(result.verification.resendAfterSeconds || 60)
      setOtp(emptyOtp())
      setMessageKind('success')
      setMessage('A fresh verification code has been sent to your email.')
      window.requestAnimationFrame(() => otpInputs.current[0]?.focus())
    } catch (error) {
      setMessageKind('error')
      setMessage(error.message)
      if (error.code === 'VERIFICATION_EXPIRED') setVerification(null)
    } finally {
      setResending(false)
    }
  }

  if (signup && verification) {
    return (
      <AuthLayout
        variant="signup"
        cardClassName="otp-portal-card"
        eyebrow="SEAL YOUR ADVENTURE"
        title="Check your inbox."
        description={`We sent a 6-digit verification code to ${verification.email}`}
      >
        <form className="otp-verification-form" onSubmit={verify} noValidate aria-busy={pending}>
          <div className="otp-email-badge">
            <span className="otp-email-icon" aria-hidden="true">
              <MailCheck size={18} strokeWidth={1.8} />
            </span>
            <span>
              <small>Verification sent to</small>
              <strong>{verification.email}</strong>
            </span>
          </div>

          <fieldset className="otp-fieldset">
            <legend>Enter verification code</legend>
            <div
              className={`otp-input-row ${fields.otp ? 'has-error' : ''}`}
              onPaste={(event) => {
                event.preventDefault()
                fillOtp(event.clipboardData.getData('text'), 0)
              }}
            >
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    otpInputs.current[index] = element
                  }}
                  className="otp-digit"
                  value={digit}
                  onChange={(event) => updateOtp(index, event.target.value)}
                  onFocus={(event) => event.target.select()}
                  onKeyDown={(event) => {
                    if (event.key === 'Backspace' && !otp[index] && index > 0)
                      otpInputs.current[index - 1]?.focus()
                    if (event.key === 'ArrowLeft' && index > 0) otpInputs.current[index - 1]?.focus()
                    if (event.key === 'ArrowRight' && index < 5) otpInputs.current[index + 1]?.focus()
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  aria-label={`Verification code digit ${index + 1}`}
                  aria-invalid={Boolean(fields.otp)}
                  disabled={pending}
                />
              ))}
            </div>
            {fields.otp && <span className="otp-field-error">{fields.otp}</span>}
          </fieldset>

          {message && (
            <p className={`form-message otp-message ${messageKind}`} role={messageKind === 'error' ? 'alert' : 'status'}>
              {message}
            </p>
          )}

          <button
            className="button button-gold full-width login-primary-button otp-verify-button"
            disabled={pending}
            type="submit"
          >
            {pending ? (
              <>
                <LoaderCircle size={17} className="spin" /> Verifying your code…
              </>
            ) : (
              <>
                Verify &amp; begin <ArrowRight size={18} />
              </>
            )}
          </button>

          <div className="otp-actions">
            <button
              className="otp-text-button"
              type="button"
              onClick={() => {
                setVerification(null)
                setResendIn(0)
                setOtp(emptyOtp())
                resetMessages()
              }}
              disabled={pending || resending}
            >
              <ArrowLeft size={14} /> Change email
            </button>
            <button
              className="otp-text-button otp-resend-button"
              type="button"
              onClick={resend}
              disabled={pending || resending || resendIn > 0}
            >
              <RefreshCw size={14} className={resending ? 'spin' : undefined} />
              {resending ? 'Sending…' : resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </form>

        <div className="auth-assurance login-assurance otp-assurance">
          <ShieldCheck size={17} />
          <span>The code expires shortly and can only be used for this signup.</span>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      variant={signup ? 'signup' : 'login'}
      eyebrow={signup ? 'YOUR ADVENTURE STARTS HERE' : 'YOUR STORY CONTINUES'}
      title={signup ? 'Begin your adventure.' : 'Welcome back,'}
      titleAccent={signup ? undefined : 'Wanderer.'}
      description={
        signup
          ? 'A character to grow with. A little more intention in every day.'
          : 'The road remembers you. Step back into your world and continue the journey.'
      }
    >
      <form
        className={`account-form login-account-form ${signup ? 'signup-account-form' : ''}`}
        onSubmit={submit}
        ref={form}
        noValidate
        aria-busy={pending}
        onChange={(event) => {
          const name = event.target.name
          if (name) setFields((previous) => ({ ...previous, [name]: undefined }))
          resetMessages()
        }}
      >
        {signup && (
          <FormField
            name="displayName"
            label="Adventurer name"
            icon={<UserRound size={17} strokeWidth={1.8} aria-hidden="true" />}
            placeholder="What should we call you?"
            autoComplete="nickname"
            maxLength={40}
            required
            error={fields.displayName}
            disabled={pending}
          />
        )}
        <FormField
          name="email"
          label="Email address"
          icon={<Mail size={17} strokeWidth={1.8} aria-hidden="true" />}
          type="email"
          placeholder="you@example.com"
          defaultValue={!signup ? rememberedEmail : undefined}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          required
          error={fields.email}
          disabled={pending}
        />
        <FormField
          name="password"
          label="Password"
          icon={<LockKeyhole size={17} strokeWidth={1.8} aria-hidden="true" />}
          type="password"
          placeholder={!signup ? 'Enter your password' : undefined}
          autoComplete={signup ? 'new-password' : 'current-password'}
          maxLength={128}
          required
          error={fields.password}
          hint={signup ? '12–128 characters. A memorable passphrase works well.' : undefined}
          disabled={pending}
        />

        {!signup && (
          <div className="login-options">
            <label className="login-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                disabled={pending}
              />
              <span>Remember me</span>
            </label>
            <Link className="login-forgot" to="/forgot-password">
              Forgot your password?
            </Link>
          </div>
        )}

        {message && (
          <p className={`form-message ${messageKind}`} role={messageKind === 'error' ? 'alert' : 'status'}>
            {message}
          </p>
        )}
        <button
          className="button button-gold full-width login-primary-button"
          disabled={pending}
          type="submit"
        >
          {pending ? (
            <>
              <LoaderCircle size={17} className="spin" />{' '}
              {signup ? 'Sending verification code…' : 'Signing in…'}
            </>
          ) : (
            <>
              {signup ? 'Create your account' : 'Continue your journey'} <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      <p className="auth-switch login-auth-switch">
        {signup ? 'Already have a story here?' : 'No journey yet?'}{' '}
        <Link to={signup ? '/login' : '/signup'} state={location.state}>
          {signup ? 'Sign in' : 'Create your adventurer'}
        </Link>
      </p>
      <div className="auth-assurance login-assurance">
        <ShieldCheck size={17} />
        <span>
          {signup
            ? 'Your account is private. Your progress is yours.'
            : 'Your journey is private. Your progress belongs to you.'}
        </span>
      </div>
    </AuthLayout>
  )
}
