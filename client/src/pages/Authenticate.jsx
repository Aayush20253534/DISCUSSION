import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { signupSchema, loginSchema } from '@atlasborn/shared'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField from '../components/FormField.jsx'
import { useAuth } from '../auth/useAuth.js'
import { readRememberedEmail, saveRememberedEmail } from '../lib/preferences.js'


export default function Authenticate({ signup = false }) {
  const auth = useAuth()
  const location = useLocation()
  const form = useRef(null)
  const [pending, setPending] = useState(false)
  const [fields, setFields] = useState({})
  const [message, setMessage] = useState('')
  const [messageKind, setMessageKind] = useState('error')
  const [rememberedEmail] = useState(readRememberedEmail)
  const [remember, setRemember] = useState(Boolean(rememberedEmail))

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
        await auth.signup(validation.data)
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
              {signup ? 'Creating your account…' : 'Signing in…'}
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
