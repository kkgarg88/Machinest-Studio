import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free CNC Resources: Videos, Excel Sheets, PDFs and Calculators',
  description: 'Free CNC machining videos, Excel sheets, PDFs and calculators for programmers, setters and machine shops. Free for everyone.',
  alternates: { canonical: '/resources' },
}

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return children
}
