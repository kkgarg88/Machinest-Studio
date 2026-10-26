'use client'
import { Bi } from './Bi'

const OR = '#F0801E'
const ST = '#8a8782'

export type Machine = '' | 'rear' | 'front' | 'other'
export type Comp = 'none' | 'g41' | 'g42'

function MachinePic({ kind, mode }: { kind: 'rear' | 'front' | 'other'; mode: 'turn' | 'face' }) {
  if (kind === 'other') {
    return (
      <svg viewBox="0 0 260 150" style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 6 }} aria-hidden="true">
        <rect x="6" y="40" width="34" height="70" rx="4" fill="#4a4744" />
        <rect x="40" y="58" width="150" height="34" fill="#6f6a64" stroke={ST} />
        <text x="130" y="82" fill="#fff" fontSize="26" textAnchor="middle" fontWeight="700">?</text>
      </svg>
    )
  }
  const rear = kind === 'rear'
  const my = (y: number) => (rear ? y : 150 - y) // front turret = the same picture turned upside down
  const face = mode === 'face'
  const pts0 = face ? [[190, 58], [208, 44], [208, 30], [258, 30], [258, 46], [218, 46]] : [[152, 58], [170, 44], [170, 30], [250, 30], [250, 46], [180, 46]]
  const poly = pts0.map(p => `${p[0]},${my(p[1])}`).join(' ')
  const ay = rear ? 52 : 98
  const id = `mp-arrow-${kind}`
  return (
    <svg viewBox="0 0 260 150" style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 6 }} aria-hidden="true">
      <rect x="6" y="40" width="34" height="70" rx="4" fill="#4a4744" />
      <text x="23" y="32" fill={ST} fontSize="10" textAnchor="middle">chuck</text>
      <rect x="40" y="58" width="150" height="34" fill="#6f6a64" stroke={ST} />
      <line x1="2" x2="258" y1="75" y2="75" stroke="#b9b3ab" strokeDasharray="10 3 2 3" strokeWidth=".9" />
      <polygon points={poly} fill={OR} />
      <circle cx={face ? 190 : 152} cy={my(58)} r="3" fill="#fff" />
      <defs><marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#fff" /></marker></defs>
      {face
        ? <line x1="200" y1={my(60)} x2="200" y2={my(72)} stroke="#fff" strokeWidth="2" markerEnd={`url(#${id})`} />
        : <line x1="146" y1={ay} x2="84" y2={ay} stroke="#fff" strokeWidth="2" markerEnd={`url(#${id})`} />}
      <text x={face ? 150 : 115} y={rear ? (face ? 50 : 44) : (face ? 100 : 116)} fill="#fff" fontSize="10" textAnchor="middle">tool path</text>
    </svg>
  )
}

const CARDS: { k: 'rear' | 'front' | 'other'; en: string; hi: string; subEn: string; subHi: string }[] = [
  { k: 'rear', en: 'Tool post above the part', hi: 'टूल पोस्ट पार्ट के ऊपर', subEn: 'Rear turret · normal slant-bed CNC lathe', subHi: 'रियर टरेट · सामान्य स्लैंट-बेड CNC लेथ' },
  { k: 'front', en: 'Tool post below the part', hi: 'टूल पोस्ट पार्ट के नीचे', subEn: 'Front turret · flat-bed lathe', subHi: 'फ्रंट टरेट · फ्लैट-बेड लेथ' },
  { k: 'other', en: 'Not sure / other', hi: 'पक्का नहीं / अन्य', subEn: 'Sliding head, gang tool post, other', subHi: 'स्लाइडिंग हेड, गैंग टूल पोस्ट, अन्य' },
]

export default function MachinePicker({ machine, comp, onMachine, onComp, mode = 'turn' }: {
  machine: Machine
  comp: Comp
  onMachine: (m: 'rear' | 'front' | 'other') => void
  onComp: (c: Comp) => void
  mode?: 'turn' | 'face' // turn = G71 (cutting towards the chuck), face = G72 (cutting towards the centre)
}) {
  const face = mode === 'face'
  const code = machine === 'rear' ? (face ? 'G41' : 'G42') : machine === 'front' ? (face ? 'G42' : 'G41') : ''
  const box = { background: '#171513', border: '1px solid #3a3733', borderLeft: `4px solid ${OR}`, borderRadius: 10, padding: '12px 14px', marginTop: 12, fontSize: 13.5, lineHeight: 1.5, color: '#ddd' } as const
  const hl = { color: '#FFB34D' } as const

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: '#fff', fontWeight: 700, fontSize: 14.5, marginBottom: 2 }}>
        <Bi en="Which machine are you cutting on?" hi="आप किस मशीन पर काम कर रहे हैं?" />
      </div>
      <div style={{ color: '#999', fontSize: 12.5, marginBottom: 10 }}>
        <Bi en="G41 or G42 depends on where the tool sits, not on the part. Pick the picture that looks like your machine."
            hi="G41 या G42 इस पर निर्भर है कि टूल कहाँ लगा है, पार्ट पर नहीं। अपनी मशीन जैसी तस्वीर चुनें।" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {CARDS.map(c => (
          <button key={c.k} type="button" onClick={() => onMachine(c.k)}
            style={{ background: machine === c.k ? 'rgba(240,128,30,.1)' : '#222120', border: `2px solid ${machine === c.k ? OR : '#3a3733'}`, borderRadius: 12, padding: 10, cursor: 'pointer', textAlign: 'center', color: '#ddd' }}>
            <MachinePic kind={c.k} mode={mode} />
            <b style={{ display: 'block', fontSize: 13.5 }}><Bi en={c.en} hi={c.hi} /></b>
            <small style={{ display: 'block', color: '#a39d94', fontSize: 11.5, marginTop: 4 }}><Bi en={c.subEn} hi={c.subHi} /></small>
          </button>
        ))}
      </div>

      {(machine === 'rear' || machine === 'front') && (
        <div style={box}>
          <Bi
            en={<>For your machine use <b style={hl}>{code}</b> and tool type <b style={hl}>3</b> for a normal OD turning tool.</>}
            hi={<>आपकी मशीन के लिए <b style={hl}>{code}</b> और सामान्य OD टर्निंग टूल के लिए टूल टाइप <b style={hl}>3</b> इस्तेमाल करें।</>} />
          <div style={{ color: '#a39d94', fontSize: 12.5, marginTop: 6 }}>
            {machine === 'rear'
              ? (face
                  ? <Bi en="The tool sits above the part and faces towards the centre. Looking along that direction the tool is on the LEFT of the face it cuts → G41."
                        hi="टूल पार्ट के ऊपर है और फेसिंग सेंटर की तरफ होती है। उस दिशा में देखने पर टूल कटे हुए फेस के बाईं (LEFT) तरफ रहता है → G41।" />
                  : <Bi en="The tool sits above the part, so it is on the RIGHT of the path when it moves towards the chuck → G42."
                        hi="टूल पार्ट के ऊपर है, इसलिए चक की तरफ चलते समय वह पाथ के दाईं (RIGHT) तरफ रहता है → G42।" />)
              : (face
                  ? <Bi en="The tool sits below the part and faces towards the centre. Looking along that direction the tool is on the RIGHT of the face it cuts → G42."
                        hi="टूल पार्ट के नीचे है और फेसिंग सेंटर की तरफ होती है। उस दिशा में देखने पर टूल कटे हुए फेस के दाईं (RIGHT) तरफ रहता है → G42।" />
                  : <Bi en="The tool sits below the part, so it is on the LEFT of the path when it moves towards the chuck → G41."
                        hi="टूल पार्ट के नीचे है, इसलिए चक की तरफ चलते समय वह पाथ के बाईं (LEFT) तरफ रहता है → G41।" />)}
            <div style={{ marginTop: 4 }}>
              <Bi en="The tool type number is the same on both machine types; only G41 / G42 changes."
                  hi="टूल टाइप नंबर दोनों मशीनों पर एक ही रहता है; सिर्फ G41 / G42 बदलता है।" />
            </div>
          </div>
        </div>
      )}
      {machine === 'other' && (
        <div style={{ ...box, borderLeftStyle: 'dashed' }}>
          <b style={hl}><Bi en="Simple rule" hi="आसान नियम" /></b>
          <div style={{ marginTop: 4 }}>
            {face
              ? <Bi en="Look along the way the tool moves while facing (towards the centre). Tool on the LEFT of the cut face → G41. Tool on the RIGHT → G42."
                    hi="देखें कि फेसिंग के समय टूल किस दिशा में चलता है (सेंटर की तरफ)। कटे हुए फेस के बाईं (LEFT) तरफ टूल हो तो G41, दाईं (RIGHT) तरफ हो तो G42।" />
              : <Bi en="Look along the way the tool moves while cutting (towards the chuck). Tool on the LEFT of the cut surface → G41. Tool on the RIGHT → G42."
                    hi="देखें कि कटिंग के समय टूल किस दिशा में चलता है (चक की तरफ)। कटे हुए सरफेस के बाईं (LEFT) तरफ टूल हो तो G41, दाईं (RIGHT) तरफ हो तो G42।" />}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {([['none', 'No compensation', 'कंपनसेशन नहीं'], ['g41', 'G41 (left)', 'G41 (बायाँ)'], ['g42', 'G42 (right)', 'G42 (दायाँ)']] as const).map(([k, en, hi]) => (
          <button key={k} type="button" onClick={() => onComp(k)}
            style={{ flex: '1 1 140px', padding: '9px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: comp === k ? OR : '#1c1b19', color: comp === k ? '#fff' : '#bbb' }}>
            <Bi en={en} hi={hi} />
          </button>
        ))}
      </div>
    </div>
  )
}
