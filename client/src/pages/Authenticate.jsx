import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react'
import { signupSchema, loginSchema } from '@life-rpg/shared'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField from '../components/FormField.jsx'
import { useAuth } from '../auth/useAuth.js'

export default function Authenticate({ signup = false }) {
  const auth = useAuth()
  const location = useLocation()
  const form = useRef(null)
  const [pending, setPending] = useState(false)
  const [fields, setFields] = useState({})
  const [message, setMessage] = useState('')
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
      eyebrow={signup ? 'YOUR ADVENTURE STARTS HERE' : 'YOUR STORY CONTINUES'}
      title={signup ? 'Begin your adventure.' : 'Welcome back, adventurer.'}
      description={
        signup
          ? 'A character to grow with. A little more intention in every day.'
          : 'Step back into your world. There’s always room for a new beginning.'
      }
    >
      <form
        className="account-form"
        onSubmit={submit}
        ref={form}
        noValidate
        aria-busy={pending}
        onChange={(event) => {
          const name = event.target.name
          setFields((previous) => ({ ...previous, [name]: undefined }))
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
          type="email"
          placeholder="you@example.com"
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
          type="password"
          autoComplete={signup ? 'new-password' : 'current-password'}
          maxLength={128}
          required
          error={fields.password}
          hint={signup ? '12–128 characters. A memorable passphrase works well.' : undefined}
          disabled={pending}
        />
        {message && (
          <p className="form-message" role="alert">
            {message}
          </p>
        )}
        <button className="button button-gold full-width" disabled={pending} type="submit">
          {pending ? (
            <>
              <LoaderCircle size={17} className="spin" />{' '}
              {signup ? 'Creating your account…' : 'Signing in…'}
            </>
          ) : (
            <>
              {signup ? 'Create your account' : 'Continue your adventure'} <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
      <p className="auth-switch">
        {signup ? 'Already have a story here?' : 'New to the adventure?'}{' '}
        <Link to={signup ? '/login' : '/signup'} state={location.state}>
          {signup ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
      <div className="auth-assurance">
        <ShieldCheck size={17} />
        <span>Your account is private. Your progress is yours.</span>
      </div>
    </AuthLayout>
  )
}
