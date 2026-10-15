'use client'

const ORANGE = '#F0801E'

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 40 40" width="34" height="34">
      {children}
    </svg>
  )
}

const icons: Record<string, () => JSX.Element> = {
  // ---------- Drilling-family (plunge) ----------
  'G81': () => (
    <Svg>
      <circle cx="20" cy="30" r="6" fill="none" stroke={ORANGE} strokeWidth="2" />
      <line x1="20" y1="4" x2="20" y2="4" stroke={ORANGE} strokeWidth="3" strokeLinecap="round">
        <animate attributeName="y2" values="4;30;4" dur="1.6s" repeatCount="indefinite" />
      </line>
    </Svg>
  ),
  'G83/G73': () => (
    <Svg>
      <circle cx="20" cy="32" r="6" fill="none" stroke={ORANGE} strokeWidth="2" />
      <line x1="20" y1="4" x2="20" y2="4" stroke={ORANGE} strokeWidth="3" strokeLinecap="round">
        <animate attributeName="y2" values="4;18;10;32;4" keyTimes="0;0.3;0.4;0.75;1" dur="2.2s" repeatCount="indefinite" />
      </line>
    </Svg>
  ),
  'G83': () => (
    <Svg>
      <circle cx="20" cy="30" r="6" fill="none" stroke={ORANGE} strokeWidth="2" />
      <line x1="20" y1="4" x2="20" y2="4" stroke={ORANGE} strokeWidth="3" strokeLinecap="round">
        <animate attributeName="y2" values="4;30;4" dur="1.6s" repeatCount="indefinite" />
      </line>
    </Svg>
  ),

  // ---------- Tapping (rotating + bobbing) ----------
  'TAP': () => (
    <Svg>
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0 20 18" to="360 20 18" dur="1.1s" repeatCount="indefinite" />
        <line x1="20" y1="4" x2="20" y2="32" stroke={ORANGE} strokeWidth="2" />
        <line x1="14" y1="10" x2="26" y2="16" stroke={ORANGE} strokeWidth="1.4" />
        <line x1="14" y1="18" x2="26" y2="24" stroke={ORANGE} strokeWidth="1.4" />
        <line x1="14" y1="26" x2="26" y2="30" stroke={ORANGE} strokeWidth="1.4" />
      </g>
    </Svg>
  ),
  'G84': () => (
    <Svg>
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0 20 18" to="360 20 18" dur="1.1s" repeatCount="indefinite" />
        <line x1="20" y1="4" x2="20" y2="32" stroke={ORANGE} strokeWidth="2" />
        <line x1="14" y1="10" x2="26" y2="16" stroke={ORANGE} strokeWidth="1.4" />
        <line x1="14" y1="18" x2="26" y2="24" stroke={ORANGE} strokeWidth="1.4" />
        <line x1="14" y1="26" x2="26" y2="30" stroke={ORANGE} strokeWidth="1.4" />
      </g>
    </Svg>
  ),

  // ---------- Face milling (raster sweep) ----------
  'FACE-MILL': () => (
    <Svg>
      <rect x="6" y="8" width="28" height="24" fill="none" stroke={ORANGE} strokeWidth="2" />
      <line x1="10" y1="20" x2="30" y2="20" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round">
        <animate attributeName="y1" values="12;28;12" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="y2" values="12;28;12" dur="1.8s" repeatCount="indefinite" />
      </line>
    </Svg>
  ),

  // ---------- Circular / helical / ellipse (orbit) ----------
  'CIRC-INTERP': () => (
    <Svg>
      <circle cx="20" cy="20" r="13" fill="none" stroke={ORANGE} strokeWidth="2" />
      <circle r="2.6" fill={ORANGE}>
        <animateMotion dur="1.6s" repeatCount="indefinite" path="M 20 7 A 13 13 0 1 1 19.99 7" />
      </circle>
    </Svg>
  ),
  'ELLIPSE': () => (
    <Svg>
      <ellipse cx="20" cy="20" rx="15" ry="9" fill="none" stroke={ORANGE} strokeWidth="2" />
      <circle r="2.6" fill={ORANGE}>
        <animateMotion dur="1.8s" repeatCount="indefinite" path="M 35 20 A 15 9 0 1 1 34.99 20" />
      </circle>
    </Svg>
  ),

  // ---------- Engraving (drawing a line) ----------
  'ENGRAVE': () => (
    <Svg>
      <line x1="10" y1="30" x2="28" y2="12" stroke="#bbb" strokeWidth="2" />
      <polygon points="28,12 32,8 34,10 30,14" fill={ORANGE} />
      <path d="M 10 30 L 14 26 L 17 29 L 20 25 L 23 28" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeDasharray="16" strokeDashoffset="16">
        <animate attributeName="stroke-dashoffset" values="16;0;16" dur="2s" repeatCount="indefinite" />
      </path>
    </Svg>
  ),

  // ---------- Turning: rough stock removal (layered sweep) ----------
  'G71': () => (
    <Svg>
      <rect x="10" y="6" width="16" height="28" fill="none" stroke={ORANGE} strokeWidth="2" />
      <line x1="10" y1="12" x2="26" y2="12" stroke={ORANGE} strokeWidth="2">
        <animate attributeName="x2" values="10;26;10" dur="1.8s" repeatCount="indefinite" />
      </line>
      <line x1="10" y1="20" x2="26" y2="20" stroke={ORANGE} strokeWidth="2" opacity="0.6">
        <animate attributeName="x2" values="10;26;10" dur="1.8s" begin="0.3s" repeatCount="indefinite" />
      </line>
      <line x1="10" y1="28" x2="26" y2="28" stroke={ORANGE} strokeWidth="2" opacity="0.3">
        <animate attributeName="x2" values="10;26;10" dur="1.8s" begin="0.6s" repeatCount="indefinite" />
      </line>
    </Svg>
  ),
  'G72': () => (
    <Svg>
      <rect x="6" y="10" width="28" height="16" fill="none" stroke={ORANGE} strokeWidth="2" />
      <line x1="12" y1="10" x2="12" y2="26" stroke={ORANGE} strokeWidth="2.5">
        <animate attributeName="x1" values="12;28;12" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="x2" values="12;28;12" dur="1.8s" repeatCount="indefinite" />
      </line>
    </Svg>
  ),

  // ---------- Grooving (radial plunge into a notch) ----------
  'GROOVE-FACE': () => (
    <Svg>
      <rect x="6" y="14" width="28" height="12" fill="none" stroke={ORANGE} strokeWidth="2" />
      <line x1="20" y1="14" x2="20" y2="14" stroke={ORANGE} strokeWidth="3" strokeLinecap="round">
        <animate attributeName="y2" values="14;24;14" dur="1.4s" repeatCount="indefinite" />
      </line>
    </Svg>
  ),
  'GROOVE-OD': () => (
    <Svg>
      <circle cx="20" cy="20" r="14" fill="none" stroke={ORANGE} strokeWidth="2" />
      <line x1="20" y1="6" x2="20" y2="6" stroke={ORANGE} strokeWidth="3" strokeLinecap="round">
        <animate attributeName="y2" values="6;13;6" dur="1.4s" repeatCount="indefinite" />
      </line>
    </Svg>
  ),

  // ---------- Threading (rotating spiral) ----------
  'THREAD-OD': () => (
    <Svg>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 -6; 0 6; 0 -6" dur="1.6s" repeatCount="indefinite" />
        <line x1="10" y1="6" x2="10" y2="34" stroke="#bbb" strokeWidth="1.5" />
        <line x1="30" y1="6" x2="30" y2="34" stroke="#bbb" strokeWidth="1.5" />
        <path d="M 10 8 Q 20 14 30 8 M 10 16 Q 20 22 30 16 M 10 24 Q 20 30 30 24" fill="none" stroke={ORANGE} strokeWidth="2" />
      </g>
    </Svg>
  ),

  // ---------- Chamfer (drawing the diagonal) ----------
  'CHAMFER': () => (
    <Svg>
      <path d="M 10 10 L 10 30 L 30 30" fill="none" stroke="#888" strokeWidth="2" />
      <path d="M 10 18 L 18 30" fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="14" strokeDashoffset="14">
        <animate attributeName="stroke-dashoffset" values="14;0;14" dur="1.6s" repeatCount="indefinite" />
      </path>
    </Svg>
  ),

  // ---------- Radius (drawing the arc) ----------
  'RADIUS': () => (
    <Svg>
      <path d="M 10 10 L 10 24 Q 10 30 16 30 L 30 30" fill="none" stroke="#888" strokeWidth="2" />
      <path d="M 10 24 Q 10 30 16 30" fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="10" strokeDashoffset="10">
        <animate attributeName="stroke-dashoffset" values="10;0;10" dur="1.6s" repeatCount="indefinite" />
      </path>
    </Svg>
  ),
}

// Fallback: gentle rotating gear outline, used for any cycle code without a specific icon yet
function DefaultIcon() {
  return (
    <Svg>
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="4s" repeatCount="indefinite" />
        <circle cx="20" cy="20" r="9" fill="none" stroke={ORANGE} strokeWidth="2" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
          <line
            key={a}
            x1={20 + 9 * Math.cos((a * Math.PI) / 180)}
            y1={20 + 9 * Math.sin((a * Math.PI) / 180)}
            x2={20 + 13 * Math.cos((a * Math.PI) / 180)}
            y2={20 + 13 * Math.sin((a * Math.PI) / 180)}
            stroke={ORANGE}
            strokeWidth="2.5"
          />
        ))}
      </g>
    </Svg>
  )
}

export default function CycleIcon({ code }: { code: string }) {
  const Icon = icons[code]
  return Icon ? <Icon /> : <DefaultIcon />
}