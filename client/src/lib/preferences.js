export function readMotionPreference() {
  try {
    return localStorage.getItem('life-rpg:gentle-motion') !== 'false'
  } catch {
    return true
  }
}

export function saveMotionPreference(value) {
  // Only display/audio preferences are local. Account/game data must live in Neon.
  try {
    localStorage.setItem('life-rpg:gentle-motion', String(value))
  } catch {
    /* A blocked storage API must not break the interface. */
  }
}

export function readSoundPreference() {
  try {
    return localStorage.getItem('life-rpg:sound-enabled') === 'true'
  } catch {
    return false
  }
}

export function saveSoundPreference(value) {
  try {
    localStorage.setItem('life-rpg:sound-enabled', String(value))
  } catch {
    /* A blocked storage API must not break the interface. */
  }
}


const REMEMBERED_EMAIL_KEY = 'life-rpg:remembered-email'

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
