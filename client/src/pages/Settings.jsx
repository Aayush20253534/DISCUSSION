import { useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  CheckCircle2,
  Compass,
  KeyRound,
  LoaderCircle,
  LogOut,
  MonitorSmartphone,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Volume2,
  Waves,
} from 'lucide-react'
import { profileSettingsSchema, changePasswordSchema } from '@atlasborn/shared'
import { useAuth } from '../auth/useAuth.js'
import FormField from '../components/FormField.jsx'
import { PageHeading } from '../components/ui.jsx'
import { useSessions, sessionsKey } from '../settings/hooks.js'

function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function timezoneOptions(current) {
  return [
    ...new Set([
      current,
      localTimezone(),
      'UTC',
      'Asia/Kolkata',
      'Asia/Kathmandu',
      ...(Intl.supportedValuesOf?.('timeZone') || []),
    ]),
  ].filter(Boolean).sort()
}

function sessionDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function Settings() {
  const auth = useAuth()
  const user = auth.user
  const queryClient = useQueryClient()
  const { gentleMotion, setGentleMotion, soundEnabled, setSoundEnabled } = useOutletContext()
  const sessions = useSessions()
  const profileForm = useRef(null)
  const passwordForm = useRef(null)
  const [profilePending, setProfilePending] = useState(false)
  const [profileFields, setProfileFields] = useState({})
  const [profileMessage, setProfileMessage] = useState('')
  const [passwordPending, setPasswordPending] = useState(false)
  const [passwordFields, setPasswordFields] = useState({})
  const [passwordMessage, setPasswordMessage] = useState('')
  const [sessionPending, setSessionPending] = useState('')
  const [sessionMessage, setSessionMessage] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  const zones = useMemo(() => timezoneOptions(user.timezone), [user.timezone])

  async function saveProfile(event) {
    event.preventDefault()
    if (profilePending) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const parsed = profileSettingsSchema.safeParse(values)
    if (!parsed.success) {
      const errors = {}
      for (const issue of parsed.error.issues) if (!errors[issue.path[0]]) errors[issue.path[0]] = issue.message
      setProfileFields(errors)
      setProfileMessage('Please check the profile details below.')
      profileForm.current.elements.namedItem(Object.keys(errors)[0])?.focus()
      return
    }
    setProfilePending(true)
    setProfileFields({})
    setProfileMessage('')
    try {
      await auth.updateProfile(parsed.data)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['activity'] })
      queryClient.invalidateQueries({ queryKey: ['quests'] })
      setProfileMessage('Profile saved. Your existing daily quest schedules keep their original timezone.')
    } catch (error) {
      setProfileFields(error.fields || {})
      setProfileMessage(error.message)
    } finally {
      setProfilePending(false)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    if (passwordPending) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    const fields = {}
    if (values.newPassword !== values.confirmPassword) fields.confirmPassword = 'Passwords do not match.'
    const parsed = changePasswordSchema.safeParse({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    })
    if (!parsed.success) {
      for (const issue of parsed.error.issues) if (!fields[issue.path[0]]) fields[issue.path[0]] = issue.message
    }
    if (Object.keys(fields).length) {
      setPasswordFields(fields)
      setPasswordMessage('Please check the password fields.')
      passwordForm.current.elements.namedItem(Object.keys(fields)[0])?.focus()
      return
    }
    setPasswordPending(true)
    setPasswordFields({})
    setPasswordMessage('')
    try {
      const result = await auth.changePassword(parsed.data)
      passwordForm.current.reset()
      await queryClient.invalidateQueries({ queryKey: sessionsKey })
      setPasswordMessage(
        result.revokedSessions
          ? `Password changed. ${result.revokedSessions} other ${result.revokedSessions === 1 ? 'session was' : 'sessions were'} signed out.`
          : 'Password changed. This session remains signed in.',
      )
    } catch (error) {
      setPasswordFields(error.fields || {})
      setPasswordMessage(error.message)
    } finally {
      setPasswordPending(false)
    }
  }

  async function revokeSession(session) {
    if (sessionPending) return
    setSessionPending(session.id)
    setSessionMessage('')
    try {
      await auth.revokeSession(session.id)
      if (!session.current) {
        await queryClient.invalidateQueries({ queryKey: sessionsKey })
        setSessionMessage('That session has been signed out.')
      }
    } catch (error) {
      setSessionMessage(error.message)
    } finally {
      setSessionPending('')
    }
  }

  async function revokeOthers() {
    if (sessionPending) return
    setSessionPending('others')
    setSessionMessage('')
    try {
      const result = await auth.revokeOtherSessions()
      await queryClient.invalidateQueries({ queryKey: sessionsKey })
      setSessionMessage(
        result.revokedSessions
          ? `${result.revokedSessions} other ${result.revokedSessions === 1 ? 'session has' : 'sessions have'} been signed out.`
          : 'There were no other active sessions to revoke.',
      )
    } catch (error) {
      setSessionMessage(error.message)
    } finally {
      setSessionPending('')
    }
  }

  async function signOut(all) {
    setSigningOut(true)
    setSessionMessage('')
    try {
      await auth.logout(all)
    } catch (error) {
      setSessionMessage(error.message)
      setSigningOut(false)
    }
  }

  const otherSessionCount = sessions.data?.sessions?.filter((session) => !session.current).length || 0

  return (
    <div className="page settings-page settings-overview-page">
      <PageHeading
        eyebrow="YOUR ADVENTURER'S QUARTERS"
        title={<>Keep your world <em>in order.</em></>}
        description="Profile, security, active devices, and the little preferences that make this adventure yours."
      />

      <section className="settings-identity-panel" aria-label="Account overview">
        <span className="settings-identity-mark" aria-hidden="true"><Compass size={30} /></span>
        <div className="settings-identity-copy">
          <span className="eyebrow">CURRENT ADVENTURER</span>
          <h2>{user.displayName}</h2>
          <p>{user.email}</p>
        </div>
        <div className="settings-identity-meta">
          <span><MapPin size={14} /> {user.timezone.replaceAll('_', ' ')}</span>
          <span><ShieldCheck size={14} /> Account protected</span>
        </div>
      </section>

      <div className="settings-grid settings-primary-grid">
        <section className="panel settings-panel settings-profile-panel">
          <div className="section-heading">
            <div><span className="eyebrow">YOUR PROFILE</span><h2>Adventurer details</h2></div>
            <ShieldCheck size={21} className="green" />
          </div>
          <form key={`${user.displayName}:${user.timezone}`} className="settings-form" onSubmit={saveProfile} ref={profileForm} noValidate aria-busy={profilePending}>
            <FormField
              name="displayName"
              label="Adventurer name"
              defaultValue={user.displayName}
              maxLength={40}
              autoComplete="nickname"
              error={profileFields.displayName}
              disabled={profilePending}
              required
            />
            <div className="form-field">
              <label htmlFor="settings-timezone">Timezone</label>
              <select
                id="settings-timezone"
                name="timezone"
                defaultValue={user.timezone}
                disabled={profilePending}
                aria-invalid={Boolean(profileFields.timezone)}
                aria-describedby="settings-timezone-hint"
              >
                {zones.map((zone) => <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>)}
              </select>
              <p className="field-hint" id="settings-timezone-hint">
                Used for activity dates and streak display. Existing daily quests keep their original schedule timezone.
              </p>
              {profileFields.timezone && <p className="field-error">{profileFields.timezone}</p>}
            </div>
            <div className="settings-readonly-field">
              <span>Email address</span>
              <strong>{user.email}</strong>
              <small>Your sign-in address is fixed for this release.</small>
            </div>
            {profileMessage && <p className={`settings-message ${profileFields.displayName || profileFields.timezone ? 'error' : ''}`} role="status">{profileMessage}</p>}
            <button className="button button-gold" type="submit" disabled={profilePending}>
              {profilePending ? <><LoaderCircle size={16} className="spin" /> Saving…</> : <><CheckCircle2 size={16} /> Save profile</>}
            </button>
          </form>
        </section>

        <section className="panel settings-panel settings-password-panel">
          <div className="section-heading">
            <div><span className="eyebrow">PASSWORD</span><h2>Guard the gate</h2></div>
            <KeyRound size={21} className="gold" />
          </div>
          <form className="settings-form" onSubmit={changePassword} ref={passwordForm} noValidate aria-busy={passwordPending}>
            <FormField name="currentPassword" label="Current password" type="password" autoComplete="current-password" maxLength={128} error={passwordFields.currentPassword} disabled={passwordPending} required />
            <FormField name="newPassword" label="New password" type="password" autoComplete="new-password" minLength={12} maxLength={128} hint="Use 12–128 characters. A sentence or several unrelated words works well." error={passwordFields.newPassword} disabled={passwordPending} required />
            <FormField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" minLength={12} maxLength={128} error={passwordFields.confirmPassword} disabled={passwordPending} required />
            {passwordMessage && <p className={`settings-message ${Object.keys(passwordFields).length ? 'error' : ''}`} role="status">{passwordMessage}</p>}
            <button className="button button-outline" type="submit" disabled={passwordPending}>
              {passwordPending ? <><LoaderCircle size={16} className="spin" /> Updating…</> : <><KeyRound size={16} /> Change password</>}
            </button>
          </form>
        </section>
      </div>

      <section className="panel settings-panel sessions-panel settings-sessions-panel">
        <div className="section-heading">
          <div><span className="eyebrow">ACTIVE SESSIONS</span><h2>Where your story is open</h2></div>
          <MonitorSmartphone size={21} className="green" />
        </div>
        {sessions.isPending ? (
          <div className="sessions-loading" role="status"><LoaderCircle className="spin" size={18} /> Loading active sessions…</div>
        ) : sessions.isError ? (
          <div className="settings-inline-error" role="alert"><span>{sessions.error.message}</span><button className="text-link" onClick={() => sessions.refetch()}><RefreshCw size={13} /> Retry</button></div>
        ) : (
          <div className="session-list">
            {sessions.data.sessions.map((session) => (
              <article className={`session-row ${session.current ? 'current' : ''}`} key={session.id}>
                <span className="session-icon"><MonitorSmartphone size={18} /></span>
                <div>
                  <strong>{session.device}</strong>
                  <span>{session.current ? 'This device · ' : ''}Signed in {sessionDate(session.createdAt)}</span>
                  <small>Expires {sessionDate(session.expiresAt)}</small>
                </div>
                <button className="button button-outline session-revoke" disabled={Boolean(sessionPending)} onClick={() => revokeSession(session)}>
                  {sessionPending === session.id ? <LoaderCircle size={14} className="spin" /> : <LogOut size={14} />}
                  {session.current ? 'Sign out' : 'Revoke'}
                </button>
              </article>
            ))}
          </div>
        )}
        <div className="session-actions">
          <button className="button button-outline" disabled={Boolean(sessionPending) || !otherSessionCount} onClick={revokeOthers}>
            {sessionPending === 'others' ? <LoaderCircle size={15} className="spin" /> : <ShieldCheck size={15} />}
            Sign out other devices
          </button>
          <button className="button button-outline danger-soft" disabled={signingOut} onClick={() => signOut(true)}><LogOut size={15} /> Sign out everywhere</button>
        </div>
        {sessionMessage && <p className="settings-message" role="status">{sessionMessage}</p>}
      </section>

      <div className="settings-grid settings-secondary-grid">
        <section className="panel settings-panel settings-preferences-panel">
          <div className="section-heading">
            <div><span className="eyebrow">LOOK, FEEL & SOUND</span><h2>Travel at your own pace</h2></div>
            <Waves size={23} className="green" />
          </div>
          <div className="setting-row">
            <div><label htmlFor="gentle-motion">Gentle animations</label><p id="motion-description">Allow celebratory transitions and subtle world movement. Your operating system’s reduced-motion setting still takes priority.</p></div>
            <input type="checkbox" role="switch" className="switch" id="gentle-motion" aria-describedby="motion-description" checked={gentleMotion} onChange={(event) => setGentleMotion(event.target.checked)} />
          </div>
          <div className="setting-row">
            <div><label htmlFor="celebration-sound">Celebration sounds</label><p id="sound-description">Allow short sounds for confirmed rewards and level-ups. This setting stays on this device and defaults to off.</p></div>
            <span className="setting-control-with-icon"><Volume2 size={18} /><input type="checkbox" role="switch" className="switch" id="celebration-sound" aria-describedby="sound-description" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} /></span>
          </div>
          <div className="setting-row">
            <div><h3>Adventure theme</h3><p>Your equipped Marketplace theme controls the application palette.</p></div>
            <div className="theme-swatches" role="img" aria-label="Current adventure palette"><i /><i /><i /></div>
          </div>
        </section>

        <section className="panel settings-panel connection-panel settings-safety-panel">
          <div className="section-heading">
            <div><span className="eyebrow">ACCOUNT SAFETY</span><h2>Your progress is carried safely</h2></div>
            <Activity size={21} className="gold" />
          </div>
          <div className="settings-safety-copy">
            <span className="settings-safety-emblem"><ShieldCheck size={28} /></span>
            <div><h3>Server-backed persistence</h3><p>Your profile, quests, progression, streak history, inventory, equipment and gold ledger are stored with your account rather than relying on local storage.</p></div>
          </div>
          <div className="settings-safety-note"><CheckCircle2 size={15} /> Cross-device progress stays attached to your account.</div>
        </section>
      </div>
    </div>
  )
}
