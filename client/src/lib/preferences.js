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
