// Shared rules for Machine Status (safe to import from browser and server code)

export const MAX_MACHINES = 100
export const MAX_OPERATORS = 3

export const STATUSES = [
  { key: 'running', label: 'Running', color: '#2fbf71' },
  { key: 'setup_change', label: 'Under Setup Change', color: '#4dabf7' },
  { key: 'breakdown', label: 'Breakdown', color: '#ff4d4f' },
  { key: 'no_plan', label: 'No Plan', color: '#9aa0a6' },
  { key: 'no_material', label: 'No Material', color: '#e0b13a' },
  { key: 'tool_change', label: 'Tool Change', color: '#2dd4bf' },
  { key: 'maintenance', label: 'Maintenance', color: '#F0801E' },
  { key: 'other', label: 'Other', color: '#b57edc' },
] as const

export const STATUS_KEYS: string[] = STATUSES.map(s => s.key)

export function statusInfo(key: string) {
  return STATUSES.find(s => s.key === key) || STATUSES[3]
}

export const MACHINE_TYPES = [
  { key: 'cnc', label: 'CNC (Turning)', badge: 'CNC', color: '#0ea5a4', image: '/machine-icons/cnc.png' },
  { key: 'vmc3', label: 'VMC 3-Axis', badge: 'VMC 3X', color: '#3b82f6', image: '/machine-icons/vmc3.png' },
  { key: 'vmc4', label: 'VMC 4-Axis', badge: 'VMC 4X', color: '#6366f1', image: '/machine-icons/vmc4.png' },
  { key: 'vmc5', label: 'VMC 5-Axis', badge: 'VMC 5X', color: '#8b5cf6', image: '/machine-icons/vmc5.png' },
  { key: 'turn_mill', label: 'Turn Mill', badge: 'TURN-MILL', color: '#d946ef', image: '/machine-icons/turn_mill.png' },
  { key: 'mill_turn', label: 'Mill Turn', badge: 'MILL-TURN', color: '#ec4899', image: '/machine-icons/mill_turn.png' },
  { key: 'hmc', label: 'HMC', badge: 'HMC', color: '#f43f5e', image: '/machine-icons/hmc.png' },
  { key: 'sliding', label: 'Sliding Head', badge: 'SLIDING', color: '#f59e0b', image: '/machine-icons/sliding.png' },
  { key: 'drilling', label: 'Drilling', badge: 'DRILLING', color: '#84cc16', image: '/machine-icons/drilling.png' },
  { key: 'tapping', label: 'Tapping', badge: 'TAPPING', color: '#22c55e', image: '/machine-icons/tapping.png' },
  { key: 'vtl', label: 'VTL', badge: 'VTL', color: '#06b6d4', image: '/machine-icons/vtl.png' },
  { key: 'other', label: 'Other', badge: 'OTHER', color: '#9aa0a6', image: '/machine-icons/other.png' },
] as const

export const TYPE_KEYS: string[] = MACHINE_TYPES.map(t => t.key)

export function typeInfo(key: string) {
  return MACHINE_TYPES.find(t => t.key === key) || MACHINE_TYPES[MACHINE_TYPES.length - 1]
}

// Text on the coloured badge. For "Other" the owner's own type name is shown.
export function typeBadge(key: string, remark?: string | null): string {
  if (key === 'other' && remark && remark.trim()) return remark.trim().toUpperCase().slice(0, 14)
  return typeInfo(key).badge
}

// Shop link names live at the site root (/kamalshop), so they must never
// collide with real pages. Add any new top-level page name here.
export const RESERVED_SLUGS = [
  'admin', 'api', 'dashboard', 'studio', 'cycle', 'profile', 'membership', 'resources', 'resume', 'ask',
  'services', 'onboarding', 'forgot-password', 'reset-password', 'login', 'signup', 'logout', 'auth',
  'machine-status', 'machine-icons', 'machinest', 'privacy', 'privacy-policy', 'terms', 'terms-and-conditions', 'about',
  'contact', 'pricing', 'refund', 'refund-policy', 'shipping', 'cancellation', 'support', 'help',
  'callback', 'static', 'public', 'favicon', 'robots', 'sitemap', 'app', 'www', 'status', 'tutorial',
  'generate', 'payment', 'webhook', 'test', 'demo', 'shop', 'shops', 'home', 'index', 'new', 'operator',
]

// 3 to 30 characters: lowercase letters, digits and hyphens; no hyphen at the ends
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

export function checkSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase()
  if (!SLUG_RE.test(slug)) return 'Link name must be 3 to 30 characters: letters, numbers and hyphens only'
  if (RESERVED_SLUGS.includes(slug)) return 'This link name is not available. Please choose another'
  return null
}

// PIN: 4 to 6 digits (public link PIN and operator PINs)
export const PIN_RE = /^\d{4,6}$/

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

// "22 Oct, 12:45 PM" in Indian time
export function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso)).replace(/\b(am|pm)\b/i, s => s.toUpperCase())
}

// Digits only, 10 to 15 long; anything else is treated as "no phone"
export function cleanPhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15 ? digits : null
}
