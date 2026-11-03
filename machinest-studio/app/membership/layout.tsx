import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Plans and Pricing',
  description: 'Choose a Machinest Studio plan: Turning Studio, Milling Studio and Machine Status, monthly or yearly. Pay only for the tools you use.',
  alternates: { canonical: '/membership' },
}

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return children
}
