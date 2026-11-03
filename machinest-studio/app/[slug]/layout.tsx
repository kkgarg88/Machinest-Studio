import type { Metadata } from 'next'

// Shop status boards, operator screens and shop reports are private to each shop: keep them out of Google.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children
}
