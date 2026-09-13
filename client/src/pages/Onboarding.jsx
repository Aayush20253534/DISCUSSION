import { useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowRight, Check, LoaderCircle } from 'lucide-react'
import { AVATARS, onboardingSchema } from '@atlasborn/shared'
import AuthLayout from '../components/AuthLayout.jsx'
import FormField from '../components/FormField.jsx'
import Portrait from '../components/Portrait.jsx'
import { useAuth, safeDestination } from '../auth/useAuth.js'

function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
const timezones = [
  ...new Set([
    'UTC',
    'Asia/Kolkata',
    'Asia/Kathmandu',
    localTimezone(),
    ...(Intl.supportedValuesOf?.('timeZone') || []),
  ]),
].sort()

export default function Onboarding() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const form = useRef(null)
  const [avatar, setAvatar] = useState('wanderer')
  const [pending, setPending] = useState(false)
  const [fields, setFields] = useState({})
  const [message, setMessage] = useState('')
  async function submit(event) {
    event.preventDefault()
    const values = { ...Object.fromEntries(new FormData(event.currentTarget)), avatarKey: avatar }
    const parsed = onboardingSchema.safeParse(values)
    if (!parsed.success) {
      const errors = Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
      )
      setFields(errors)
      setMessage('Please check your profile details.')
      form.current.elements.namedItem(Object.keys(errors)[0])?.focus()
      return
    }
    if (pending) return
    setPending(true)
    setFields({})
    setMessage('')
    try {
      await auth.onboard(parsed.data)
      navigate(safeDestination(location.state?.from), { replace: true })
    } catch (error) {
      setMessage(error.message)
      setFields(error.fields || {})
    } finally {
      setPending(false)
    }
  }
  async function signOut() {
    setPending(true)
    setMessage('')
    try {
      await auth.logout()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setPending(false)
    }
  }
  return (
    <AuthLayout
      eyebrow="CHAPTER 02 · MEET YOUR CHARACTER"
      title="Make this story yours."
      description="Choose a companion for the journey. Every adventurer starts with the same possibilities."
    >
      <form
        className="account-form onboarding-form"
        onSubmit={submit}
        ref={form}
        noValidate
        aria-busy={pending}
      >
        <fieldset className="avatar-picker" disabled={pending}>
          <legend>Choose your avatar</legend>
          <div className="avatar-options">
            {AVATARS.map((item) => (
              <label
                className={`avatar-option ${avatar === item.key ? 'chosen' : ''}`}
                key={item.key}
              >
                <input
                  type="radio"
                  name="avatarKey"
                  value={item.key}
                  checked={avatar === item.key}
                  onChange={() => setAvatar(item.key)}
                />
                <Portrait avatarKey={item.key} />
                <strong>{item.name}</strong>
                <span>{item.description}</span>
                {avatar === item.key && (
                  <Check className="avatar-check" size={17} aria-hidden="true" />
                )}
              </label>
            ))}
          </div>
        </fieldset>
        <FormField
          name="displayName"
          label="Adventurer name"
          defaultValue={auth.user.displayName}
          autoComplete="nickname"
          maxLength={40}
          required
          error={fields.displayName}
          disabled={pending}
        />
        <div className="form-field">
          <label htmlFor="timezone">Your timezone</label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={localTimezone()}
            disabled={pending}
            aria-invalid={Boolean(fields.timezone)}
            aria-describedby="timezone-hint"
          >
            {timezones.map((zone) => (
              <option value={zone} key={zone}>
                {zone.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <p className="field-hint" id="timezone-hint">
            Saved for your daily adventure. {fields.timezone}
          </p>
        </div>
        <div className="starting-stats">
          <span>
            <strong>1</strong> LEVEL
          </span>
          <span>
            <strong>0</strong> XP
          </span>
          <span>
            <strong>0</strong> GOLD
          </span>
        </div>
        {message && (
          <p className="form-message" role="alert">
            {message}
          </p>
        )}
        <button className="button button-gold full-width" disabled={pending} type="submit">
          {pending ? (
            <>
              <LoaderCircle size={17} className="spin" /> Saving…
            </>
          ) : (
            <>
              Enter your world <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
      <button className="text-link onboarding-signout" disabled={pending} onClick={signOut}>
        Sign out of {auth.user.email}
      </button>
    </AuthLayout>
  )
}
