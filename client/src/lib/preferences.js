export function readMotionPreference() {
  try {
    return localStorage.getItem('life-rpg:gentle-motion') !== 'false'
  } catch {
    return true
  }
}

export function saveMotionPreference(value) {
  // Only this display preference is local. Account/game data must live in Neon.
  try {
    localStorage.setItem('life-rpg:gentle-motion', String(value))
  } catch {
    /* A blocked storage API must not break the interface. */
  }
}
