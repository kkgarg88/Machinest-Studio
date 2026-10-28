// Phone numbers: country code list, checks and saving format. Safe to use in the browser.
// India numbers are saved as the plain 10 digits (as before). Every other country is saved as +<code><number>.

export type Country = { id: string; name: string; code: string } // code without the +

export const COUNTRIES: Country[] = [
  { id: 'IN', name: 'India', code: '91' },
  { id: 'AE', name: 'UAE', code: '971' },
  { id: 'SA', name: 'Saudi Arabia', code: '966' },
  { id: 'QA', name: 'Qatar', code: '974' },
  { id: 'OM', name: 'Oman', code: '968' },
  { id: 'KW', name: 'Kuwait', code: '965' },
  { id: 'BH', name: 'Bahrain', code: '973' },
  { id: 'NP', name: 'Nepal', code: '977' },
  { id: 'BD', name: 'Bangladesh', code: '880' },
  { id: 'LK', name: 'Sri Lanka', code: '94' },
  { id: 'PK', name: 'Pakistan', code: '92' },
  { id: 'BT', name: 'Bhutan', code: '975' },
  { id: 'MV', name: 'Maldives', code: '960' },
  { id: 'AF', name: 'Afghanistan', code: '93' },
  { id: 'AU', name: 'Australia', code: '61' },
  { id: 'CA', name: 'Canada', code: '1' },
  { id: 'CN', name: 'China', code: '86' },
  { id: 'EG', name: 'Egypt', code: '20' },
  { id: 'FR', name: 'France', code: '33' },
  { id: 'DE', name: 'Germany', code: '49' },
  { id: 'ID', name: 'Indonesia', code: '62' },
  { id: 'IT', name: 'Italy', code: '39' },
  { id: 'JP', name: 'Japan', code: '81' },
  { id: 'KE', name: 'Kenya', code: '254' },
  { id: 'MY', name: 'Malaysia', code: '60' },
  { id: 'NG', name: 'Nigeria', code: '234' },
  { id: 'PH', name: 'Philippines', code: '63' },
  { id: 'SG', name: 'Singapore', code: '65' },
  { id: 'ZA', name: 'South Africa', code: '27' },
  { id: 'KR', name: 'South Korea', code: '82' },
  { id: 'TH', name: 'Thailand', code: '66' },
  { id: 'TR', name: 'Turkey', code: '90' },
  { id: 'GB', name: 'United Kingdom', code: '44' },
  { id: 'US', name: 'United States', code: '1' },
  { id: 'VN', name: 'Vietnam', code: '84' },
]
export const OTHER = 'OTHER' // the user types the full number starting with +

export type PhoneValue = { country: string; number: string }

const digitsOf = (s: string) => s.replace(/\D/g, '')
const byLongestCode = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length)

export const DEFAULT_PHONE: PhoneValue = { country: 'IN', number: '' }

// Turns a saved value ("9876543210" or "+971501234567") back into country and number
export function parseSaved(saved: string | null | undefined): PhoneValue {
  const s = String(saved ?? '').trim()
  if (!s) return { ...DEFAULT_PHONE }
  if (s.startsWith('+')) {
    const d = digitsOf(s)
    const hit = byLongestCode.find(c => d.startsWith(c.code))
    if (hit) {
      // +1 is shared by the US and Canada
      return { country: hit.id === 'CA' ? 'US' : hit.id, number: d.slice(hit.code.length) }
    }
    return { country: OTHER, number: '+' + d }
  }
  const d = digitsOf(s)
  return { country: 'IN', number: d.length > 10 ? d.slice(-10) : d }
}

// Checks the number. Returns an error text, or '' when the number is fine.
export function checkPhone(v: PhoneValue): string {
  const raw = v.number.trim()
  if (!raw) return 'Please enter your mobile number.'
  if (v.country === OTHER) {
    const d = digitsOf(raw)
    if (!raw.startsWith('+')) return 'Start the number with + and your country code, for example +49 151 2345678.'
    if (d.length < 8 || d.length > 15) return 'Please enter a valid international number with your country code.'
    return ''
  }
  const country = COUNTRIES.find(c => c.id === v.country)
  if (!country) return 'Please choose your country code.'
  let d = digitsOf(raw)
  if (v.country === 'IN') {
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
    return /^[6-9]\d{9}$/.test(d) ? '' : 'Please enter a valid 10-digit Indian mobile number.'
  }
  if (d.startsWith(country.code) && d.length > country.code.length + 6) d = d.slice(country.code.length)
  d = d.replace(/^0+/, '')
  if (d.length < 6 || d.length > 14 || country.code.length + d.length > 15) return `Please enter a valid ${country.name} mobile number (without the country code).`
  return ''
}

// The value that is saved. Call only after checkPhone returned ''.
export function formatForSave(v: PhoneValue): string {
  if (v.country === OTHER) return '+' + digitsOf(v.number)
  const country = COUNTRIES.find(c => c.id === v.country)!
  let d = digitsOf(v.number)
  if (v.country === 'IN') {
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
    return d
  }
  if (d.startsWith(country.code) && d.length > country.code.length + 6) d = d.slice(country.code.length)
  d = d.replace(/^0+/, '')
  return '+' + country.code + d
}
