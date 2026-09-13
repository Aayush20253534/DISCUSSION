import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, LoaderCircle, Mail, ShieldCheck } from 'lucide-react'
import { passwordResetRequestSchema, passwordResetSchema } from '@life-rpg/shared'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField from '../components/FormField.jsx'
import { useAuth } from '../auth/useAuth.js'
import { readRememberedEmail } from '../lib/preferences.js'

export default function PasswordRecovery() {
  const auth = useAuth()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const resetting = Boolean(token)
  const form = useRef(null)
  const [pending, setPending] = useState(false)
  const [fields, setFields] = useState({})
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (pending) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const fieldErrors = {}
    let parsed

    if (resetting) {
      if (values.newPassword !== values.confirmPassword) {
        fieldErrors.confirmPassword = 'Passwords do not match.'
      }
      parsed = passwordResetSchema.safeParse({ token, newPassword: values.newPassword })
    } else {
      parsed = passwordResetRequestSchema.safeParse({ email: values.email })
    }

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] && !fieldErrors[issue.path[0]]) fieldErrors[issue.path[0]] = issue.message
      }
    }
    if (Object.keys(fieldErrors).length) {
      setFields(fieldErrors)
      setMessage('Please check the highlighted fields.')
      form.current?.elements.namedItem(Object.keys(fieldErrors)[0])?.focus()
      return
    }

    setPending(true)
    setFields({})
    setMessage('')
    try {
      if (resetting) {
        await auth.resetPassword(parsed.data)
        setSuccess(true)
        setMessage('Your password has been changed. All previous sessions were signed out.')
      } else {
        const result = await auth.requestPasswordReset(parsed.data)
        setSuccess(true)
        setMessage(result.message || 'If that email belongs to a Life RPG account, a recovery link is on its way.')
      }
    } catch (error) {
      setFields(error.fields || {})
      setMessage(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      variant="login"
      cardClassName="password-recovery-card"
      eyebrow={resetting ? 'FORGE A NEW KEY' : 'RECOVER YOUR PATH'}
      title={resetting ? 'Choose a new' : 'Find your way'}
      titleAccent={resetting ? 'password.' : 'back.'}
      description={
        resetting
          ? 'Set a fresh password for your account. The old sessions will be closed when you finish.'
          : 'Enter your email and, if it belongs to an account, we’ll send a secure recovery link.'
      }
    >
      {success ? (
        <div className="recovery-success" role="status">
          <span className="recovery-success-icon"><CheckCircle2 size={24} /></span>
          <h2>{resetting ? 'The gate is open again.' : 'Check your inbox.'}</h2>
          <p>{message}</p>
          <Link className="button button-gold full-width login-primary-button" to="/login">
            Return to sign in <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        <form className="account-form login-account-form recovery-form" onSubmit={submit} ref={form} noValidate aria-busy={pending}>
          {resetting ? (
            <>
              <FormField
                name="newPassword"
                label="New password"
                icon={<KeyRound size={17} strokeWidth={1.8} aria-hidden="true" />}
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                hint="Use 12–128 characters. A memorable passphrase works well."
                error={fields.newPassword}
                disabled={pending}
                required
              />
              <FormField
                name="confirmPassword"
                label="Confirm new password"
                icon={<ShieldCheck size={17} strokeWidth={1.8} aria-hidden="true" />}
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                error={fields.confirmPassword}
                disabled={pending}
                required
              />
            </>
          ) : (
            <FormField
              name="email"
              label="Email address"
              icon={<Mail size={17} strokeWidth={1.8} aria-hidden="true" />}
              type="email"
              defaultValue={readRememberedEmail() || undefined}
              placeholder="you@example.com"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              error={fields.email}
              disabled={pending}
              required
            />
          )}

          {message && <p className="form-message" role="alert">{message}</p>}
          <button className="button button-gold full-width login-primary-button" disabled={pending} type="submit">
            {pending ? (
              <><LoaderCircle size={17} className="spin" /> {resetting ? 'Changing password…' : 'Sending recovery link…'}</>
            ) : (
              <>{resetting ? 'Set new password' : 'Send recovery link'} <ArrowRight size={18} /></>
            )}
          </button>
          <Link className="recovery-back-link" to="/login"><ArrowLeft size={14} /> Back to sign in</Link>
        </form>
      )}
    </AuthLayout>
  )
}
