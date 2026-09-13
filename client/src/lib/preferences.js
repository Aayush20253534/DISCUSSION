export function readMotionPreference() {
  try {
    return localStorage.getItem('atlasborn:gentle-motion') !== 'false'
  } catch {
    return true
  }
}

export function saveMotionPreference(value) {
  // Only display/audio preferences are local. Account/game data must live in Neon.
  try {
    localStorage.setItem('atlasborn:gentle-motion', String(value))
  } catch {
    /* A blocked storage API must not break the interface. */
  }
}

export function readSoundPreference() {
  try {
    return localStorage.getItem('atlasborn:sound-enabled') === 'true'
  } catch {
    return false
  }
}

export function saveSoundPreference(value) {
  try {
    localStorage.setItem('atlasborn:sound-enabled', String(value))
  } catch {
    /* A blocked storage API must not break the interface. */
  }
}


const REMEMBERED_EMAIL_KEY = 'atlasborn:remembered-email'

export function readRememberedEmail() {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) || ''
  } catch {
    return ''
  }
}

export function saveRememberedEmail(email, remember) {
  try {
    if (remember) localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
    else localStorage.removeItem(REMEMBERED_EMAIL_KEY)
  } catch {
    /* A blocked storage API must not break sign-in. */
  }
}
