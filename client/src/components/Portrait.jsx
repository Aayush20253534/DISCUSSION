export default function Portrait({ className = '' }) {
  return (
    <svg
      className={`portrait ${className}`}
      viewBox="0 0 160 160"
      role="img"
      aria-label="The Wanderer, a cloaked adventurer"
    >
      <circle cx="80" cy="80" r="77" fill="#213e3c" />
      <circle cx="80" cy="80" r="67" fill="none" stroke="#668071" strokeOpacity=".4" />
      <path d="m23 130 22-29 19-10h33l18 12 23 27a77 77 0 0 1-115 0Z" fill="#4c7363" />
      <path d="M44 94c-5-33 8-65 35-68 29-2 46 36 41 68L81 113Z" fill="#668a70" />
      <path d="M56 87c-4-25 6-44 23-46 20-2 31 21 30 46l-29 20Z" fill="#172c2a" />
      <path d="M66 70c0-10 26-10 26 0v17l-13 12-13-12Z" fill="#c7aa82" />
      <path d="M62 70c2-12 11-19 20-16l12 14-8-2-10-6Z" fill="#3f342a" />
      <path d="m46 95 34 12 35-12-17 29-18-11-21 12Z" fill="#8ea287" />
      <path d="m79 113 1 37m-11-19 10-18 16 34" stroke="#2a5247" strokeWidth="3" />
      <circle cx="80" cy="111" r="5" fill="#d3b471" />
      <path d="m115 108 7 27" stroke="#baa178" strokeWidth="7" />
      <path d="m114 103 4-16 8-2 2 9-7 10" stroke="#baa178" strokeWidth="4" fill="none" />
    </svg>
  )
}
