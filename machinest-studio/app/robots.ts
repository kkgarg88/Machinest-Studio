import type { MetadataRoute } from 'next'

const BASE = 'https://app.machinest.in'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin',
          '/dashboard',
          '/machine-status',
          '/profile',
          '/onboarding',
          '/cycle/',
          '/studio/',
          '/resume',
          '/ask',
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  }
}
