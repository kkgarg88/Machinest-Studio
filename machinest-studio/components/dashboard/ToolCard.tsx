'use client'
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { TurningArt, MillingArt, StatusArt, GenericArt } from './ToolArt'

export type DashTool = {
  id: string
  name: string
  slug: string
  description: string | null
  features: string[] | null
}

export type ToolPrice = { monthly: number; annual: number | null }

const ICON: Record<string, string> = { 'turning-studio': '🔩', 'milling-studio': '⚙️', 'machine-status': '📟' }

function Art({ tool }: { tool: DashTool }) {
  if (tool.slug === 'turning-studio') return <TurningArt />
  if (tool.slug === 'milling-studio') return <MillingArt />
  if (tool.slug === 'machine-status') return <StatusArt />
  return <GenericArt icon={ICON[tool.slug] || '🛠️'} />
}

function openPath(tool: DashTool): string {
  return tool.slug === 'machine-status' ? '/machine-status' : `/studio/${tool.slug}`
}

const rupees = (n: number) => '₹' + new Intl.NumberFormat('en-IN').format(n)

export default function ToolCard({
  tool, subscribed, expiresAt, price,
}: {
  tool: DashTool
  subscribed: boolean
  expiresAt?: string | null
  price?: ToolPrice | null
}) {
  const router = useRouter()
  const barRef = useRef<HTMLElement>(null)

  const daysLeft = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)) : null
  const total = daysLeft !== null && daysLeft > 31 ? 365 : 30
  const pct = daysLeft === null ? 100 : Math.max(4, Math.min(100, Math.round((daysLeft / total) * 100)))
  const low = daysLeft !== null && daysLeft <= 7

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    const id = requestAnimationFrame(() => { el.style.width = `${pct}%` })
    return () => cancelAnimationFrame(id)
  }, [pct])

  const features = (tool.features || []).filter(Boolean).slice(0, 3)
  const noTrial = tool.slug === 'machine-status'

  return (
    <article
      className={`dbx-tool ${subscribed ? 'dbx-active' : 'dbx-trial'}`}
      onClick={() => router.push(subscribed ? openPath(tool) : noTrial ? '/membership' : openPath(tool))}
    >
      <div className="dbx-stage">
        <Art tool={tool} />
        {!subscribed && <span className="dbx-ribbon">{noTrial ? 'Premium' : 'Free trial'}</span>}
      </div>

      <div className="dbx-body">
        <h3>{tool.name}</h3>
        {tool.description && <p className="dbx-desc">{tool.description}</p>}
        {features.length > 0 && <div className="dbx-chips">{features.map((f, i) => <span key={i}>{f}</span>)}</div>}

        {subscribed ? (
          <>
            <div className="dbx-life">
              <div className="dbx-row">
                <span>Subscription</span>
                <b className={low ? 'dbx-warn' : ''}>{daysLeft === null ? 'No expiry' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</b>
              </div>
              <div className="dbx-bar"><i ref={barRef} className={low ? 'dbx-low' : ''} style={{ ['--w' as string]: `${pct}%` }} /></div>
            </div>
            <div className="dbx-cta">
              <button className="dbx-btn dbx-main" onClick={e => { e.stopPropagation(); router.push(openPath(tool)) }}>
                {tool.slug === 'machine-status' ? 'Open board' : 'Open Studio'}
              </button>
              {low && (
                <button className="dbx-btn dbx-ghost" onClick={e => { e.stopPropagation(); router.push('/membership') }}>Renew</button>
              )}
            </div>
          </>
        ) : (
          <>
            {price && (
              <div className="dbx-price">
                <span className="dbx-from">From</span>
                <strong>{rupees(price.monthly)}</strong>
                <span className="dbx-per">/ month</span>
                {price.annual ? <span className="dbx-alt">or {rupees(price.annual)} a year</span> : null}
              </div>
            )}
            <div className="dbx-cta">
              <button className="dbx-btn dbx-try" onClick={e => { e.stopPropagation(); router.push(noTrial ? '/membership' : openPath(tool)) }}>
                {noTrial ? 'View plans' : 'Trial now'}
              </button>
            </div>
            {!noTrial && <div className="dbx-note">Try the free cycle before you subscribe.</div>}
          </>
        )}
      </div>
    </article>
  )
}
