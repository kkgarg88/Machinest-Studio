import type { MetadataRoute } from 'next'

const BASE = 'https://app.machinest.in'

// Public pages only. Add new public pages (articles, tools) to this list as they are built.
const PAGES: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/resources', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/membership', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/services', priority: 0.6, changeFrequency: 'monthly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return PAGES.map(p => ({
    url: `${BASE}${p.path === '/' ? '' : p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }))
}
