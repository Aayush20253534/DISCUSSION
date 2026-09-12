import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, LoaderCircle, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { signupSchema, loginSchema } from '@life-rpg/shared'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField from '../components/FormField.jsx'
import { useAuth } from '../auth/useAuth.js'

const REMEMBERED_EMAIL_KEY = 'life-rpg:remembered-email'

function readRememberedEmail() {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || ''
  } catch {
    return ''
  }
}

function saveRememberedEmail(email, remember) {
  if (typeof window === 'undefined') return
  try {
    if (remember) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
    else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY)
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export default function Authenticate({ signup = false }) {
  const auth = useAuth()
  const location = useLocation()
  const form = useRef(null)
  const [pending, setPending] = useState(false)
  const [fields, setFields] = useState({})
  const [message, setMessage] = useState('')
  const [rememberedEmail] = useState(readRememberedEmail)
  const [remember, setRemember] = useState(Boolean(rememberedEmail))

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
      setMessage('Please check the highlighted fields.')
      form.current.elements.namedItem(Object.keys(errors)[0])?.focus()
      return
    }
    setPending(true)
    setMessage('')
    setFields({})
    try {
      await auth[signup ? 'signup' : 'login'](validation.data)
      if (!signup) saveRememberedEmail(validation.data.email, remember)
    } catch (error) {
      setMessage(error.message)
      setFields(error.fields || {})
      form.current?.elements.namedItem(Object.keys(error.fields || {})[0])?.focus()
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout
      variant={signup ? 'default' : 'login'}
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
        className={`account-form ${signup ? '' : 'login-account-form'}`}
        onSubmit={submit}
        ref={form}
        noValidate
        aria-busy={pending}
        onChange={(event) => {
          const name = event.target.name
          if (name) setFields((previous) => ({ ...previous, [name]: undefined }))
          setMessage('')
        }}
      >
        {signup && (
          <FormField
            name="displayName"
            label="Adventurer name"
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
          icon={!signup ? <Mail size={17} strokeWidth={1.8} aria-hidden="true" /> : undefined}
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
          icon={!signup ? <LockKeyhole size={17} strokeWidth={1.8} aria-hidden="true" /> : undefined}
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
            <span
              className="login-forgot"
              aria-disabled="true"
              title="Password recovery is not configured in this build yet."
            >
              Forgot your password?
            </span>
          </div>
        )}

        {message && (
          <p className="form-message" role="alert">
            {message}
          </p>
        )}
        <button
          className={`button button-gold full-width ${signup ? '' : 'login-primary-button'}`}
          disabled={pending}
          type="submit"
        >
          {pending ? (
            <>
              <LoaderCircle size={17} className="spin" />{' '}
              {signup ? 'Creating your account…' : 'Signing in…'}
            </>
          ) : (
            <>
              {signup ? 'Create your account' : 'Continue your journey'} <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>

      {!signup && (
        <>
          <div className="login-divider" aria-hidden="true">
            <span>OR</span>
          </div>
          <div className="login-social-grid" aria-label="Social sign in providers">
            <button
              type="button"
              className="login-social-button"
              disabled
              title="Google sign-in is not configured in this build."
            >
              <span className="login-google-mark" aria-hidden="true">
                G
              </span>
              <span>Continue with Google</span>
            </button>
            <button
              type="button"
              className="login-social-button"
              disabled
              title="Apple sign-in is not configured in this build."
            >
              <span className="login-apple-mark" aria-hidden="true" />
              <span>Continue with Apple</span>
            </button>
          </div>
        </>
      )}

      <p className={`auth-switch ${signup ? '' : 'login-auth-switch'}`}>
        {signup ? 'Already have a story here?' : 'No journey yet?'}{' '}
        <Link to={signup ? '/login' : '/signup'} state={location.state}>
          {signup ? 'Sign in' : 'Create your adventurer'}
        </Link>
      </p>
      <div className={`auth-assurance ${signup ? '' : 'login-assurance'}`}>
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
