import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Free CNC Resources: Videos, Excel Sheets, PDFs and Calculators',
  description: 'for everyone in manufacturing: programmers, setters, operators, quality and maintenance teams, and students. Free.',
  alternates: { canonical: '/resources' },
}

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return children
}
