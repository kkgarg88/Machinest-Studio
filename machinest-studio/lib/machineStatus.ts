// Shared rules for Machine Status (safe to import from browser and server code)

export const MAX_MACHINES = 100
export const MAX_OPERATORS = 3

export const STATUSES = [
  { key: 'running', label: 'Running', color: '#2fbf71' },
  { key: 'idle', label: 'Idle', color: '#9aa0a6' },
  { key: 'setup', label: 'Setup', color: '#4dabf7' },
  { key: 'breakdown', label: 'Breakdown', color: '#ff4d4f' },
  { key: 'maintenance', label: 'Maintenance', color: '#F0801E' },
  { key: 'waiting_material', label: 'Waiting for material', color: '#e0b13a' },
  { key: 'other', label: 'Other', color: '#b57edc' },
] as const

export const STATUS_KEYS: string[] = STATUSES.map(s => s.key)

export function statusInfo(key: string) {
  return STATUSES.find(s => s.key === key) || STATUSES[1]
}

export const MACHINE_ICONS = [
  { key: 'lathe', label: 'Lathe / Turning', emoji: '🔩' },
  { key: 'vmc', label: 'VMC / Milling', emoji: '⚙️' },
  { key: 'swiss', label: 'Sliding Head', emoji: '📏' },
  { key: 'drilling', label: 'Drilling / Tapping', emoji: '🔧' },
  { key: 'other', label: 'Other', emoji: '🛠️' },
] as const

export const ICON_KEYS: string[] = MACHINE_ICONS.map(i => i.key)

export function iconEmoji(key: string): string {
  return (MACHINE_ICONS.find(i => i.key === key) || MACHINE_ICONS[4]).emoji
}

// Shop link names live at the site root (/kamalshop), so they must never
// collide with real pages. Add any new top-level page name here.
export const RESERVED_SLUGS = [
  'admin', 'api', 'dashboard', 'studio', 'cycle', 'profile', 'membership', 'resources', 'resume', 'ask',
  'services', 'onboarding', 'forgot-password', 'reset-password', 'login', 'signup', 'logout', 'auth',
  'machine-status', 'machinest', 'privacy', 'privacy-policy', 'terms', 'terms-and-conditions', 'about',
  'contact', 'pricing', 'refund', 'refund-policy', 'shipping', 'cancellation', 'support', 'help',
  'callback', 'static', 'public', 'favicon', 'robots', 'sitemap', 'app', 'www', 'status', 'tutorial',
  'generate', 'payment', 'webhook', 'test', 'demo', 'shop', 'shops', 'home', 'index', 'new',
]

// 3 to 30 characters: lowercase letters, digits and hyphens; no hyphen at the ends
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

export function checkSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase()
  if (!SLUG_RE.test(slug)) return 'Link name must be 3 to 30 characters: letters, numbers and hyphens only'
  if (RESERVED_SLUGS.includes(slug)) return 'This link name is not available. Please choose another'
  return null
}

// Public link PIN: 4 to 6 digits
export const PIN_RE = /^\d{4,6}$/

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

// "5m", "2h 10m", "1d 3h"
export function formatSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.floor(ms / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}
