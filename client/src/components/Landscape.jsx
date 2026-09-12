import { useId } from 'react'

// Original vector artwork: local, crisp at every size, no remote image requests.
export default function Landscape({ className = '' }) {
  const id = useId().replaceAll(':', '')
  return (
    <svg
      className={`landscape ${className}`}
      viewBox="0 0 900 450"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient
          id={`${id}-sky`}
          x1="450"
          y1="0"
          x2="450"
          y2="450"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#173538" />
          <stop offset=".65" stopColor="#48695c" />
          <stop offset="1" stopColor="#adb88c" />
        </linearGradient>
        <linearGradient
          id={`${id}-mist`}
          x1="0"
          y1="0"
          x2="900"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#112423" />
          <stop offset="1" stopColor="#143732" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${id}-trail`}
          x1="610"
          y1="300"
          x2="590"
          y2="450"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#9e9c72" />
          <stop offset="1" stopColor="#556e54" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id}-sky)`} d="M0 0h900v450H0z" />
      <circle cx="713" cy="105" r="61" fill="#dcd8ab" opacity=".06" />
      <circle cx="713" cy="105" r="44" fill="#dcd8ab" opacity=".07" />
      <circle cx="713" cy="105" r="30" fill="#dcd8ab" opacity=".68" />
      <g fill="#d9ddbc" opacity=".55">
        <circle cx="550" cy="45" r="1" />
        <circle cx="655" cy="27" r="1.4" />
        <circle cx="790" cy="64" r="1" />
        <circle cx="465" cy="88" r="1" />
        <circle cx="850" cy="30" r="1.5" />
        <circle cx="610" cy="84" r="1" />
        <circle cx="790" cy="129" r="1" />
      </g>
      <path
        d="M310 276 430 129 498 196 561 112 670 244 759 162 900 270V450H310Z"
        fill="#789284"
        opacity=".4"
      />
      <path
        d="m430 129-48 88 49-19 23 16 13-10Zm131-17-36 78 38-21 40 15Z"
        fill="#b6c1a4"
        opacity=".27"
      />
      <path d="M134 339 301 206 417 290 499 219 624 313 770 230 900 291V450H134Z" fill="#3f6658" />
      <path
        d="M0 361c152-66 285-60 391-25 134 43 208-61 331-54 57 3 123 45 178 31v137H0Z"
        fill="#2e5045"
      />
      <path
        d="M473 340c78-55 92-57 140-51 37 5 57 24 89 18 56-10 108-3 198 49v94H401Z"
        fill="#24473d"
      />
      <path
        d="M601 450c-79-29-106-51-59-74 41-20 117-30 87-50-14-10-40-18-29-30 2-2 9-4 14-5-15 11 14 18 26 26 50 32-19 49-43 66-29 20 20 46 69 67Z"
        fill={`url(#${id}-trail)`}
      />
      <g>
        <path d="m598 202 29-9 18 14-5 87-43 3Z" fill="#a7ad8e" />
        <path d="m627 193 18 14-5 87-16-2Z" fill="#647969" />
        <path d="m591 204 10-10 8-30 19-15 14 23 5 26 5 9Z" fill="#1b3c37" />
        <path d="m609 164 19-15-3 43-24 2Z" fill="#30574a" />
        <path d="M618 154v-37l23 8-23 10" stroke="#a8a97c" strokeWidth="2" />
        <path d="m620 119 20 7-20 7Z" fill="#d6b777" />
        <path d="M607 220a5 5 0 0 1 10 0v9h-10Z" fill="#e2c98e" />
        <path d="M607 275a7 7 0 0 1 14 0v19h-14Z" fill="#233d32" />
        <path d="M600 239h38m-38 17h37" stroke="#788c71" strokeWidth="2" />
        <path d="m592 296 53-2 7 6-65 4Z" fill="#8a9b7d" />
      </g>
      <g fill="#173b33">
        <path d="m756 237-23 63h15l-25 36h64l-22-36h13Z" />
        <path d="m799 266-21 51h12l-22 32h58l-22-32h13Z" />
        <path d="m457 303-23 59h15l-23 35h62l-24-35h14Z" />
        <path d="m691 290-16 39h9l-16 25h45l-18-25h10Z" />
      </g>
      <path d="M0 310c122 18 200 96 332 110 34 4 74 12 113 30H0Z" fill="#112d28" />
      <path d="M702 450c94-59 110-90 198-84v84Z" fill="#12332b" />
      <g fill="#0d2924">
        <path d="m67 181-43 105h26L11 345h37L0 414h138l-46-69h36l-38-59h22Z" />
        <path d="m186 262-30 81h16l-32 46h90l-33-46h18Z" />
        <path d="m872 218-35 84h22l-38 58h104l-38-58h20Z" />
      </g>
      <path fill={`url(#${id}-mist)`} d="M0 0h900v450H0z" />
      <g className="fireflies" fill="#dbce8f">
        <circle cx="515" cy="338" r="2" />
        <circle cx="725" cy="366" r="1.5" />
        <circle cx="410" cy="324" r="1.7" />
        <circle cx="778" cy="239" r="1.5" />
      </g>
    </svg>
  )
}
