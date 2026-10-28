'use client'
import { COUNTRIES, OTHER, PhoneValue } from '@/lib/phone'

// Country code list and the mobile number box, side by side
export default function PhoneInput({ value, onChange, inputStyle }: {
  value: PhoneValue
  onChange: (v: PhoneValue) => void
  inputStyle: React.CSSProperties
}) {
  const isOther = value.country === OTHER
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <select
        aria-label="Country code"
        value={value.country}
        onChange={e => onChange({ country: e.target.value, number: value.number })}
        style={{ ...inputStyle, width: 'auto', flex: '0 0 138px', paddingLeft: 10, paddingRight: 6 }}
      >
        {COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.name} (+{c.code})</option>)}
        <option value={OTHER}>Other country</option>
      </select>
      <input
        type="tel"
        inputMode="tel"
        value={value.number}
        onChange={e => onChange({ country: value.country, number: e.target.value })}
        style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        placeholder={isOther ? '+49 151 2345678' : value.country === 'IN' ? '9XXXXXXXXX' : 'Mobile number'}
      />
    </div>
  )
}
