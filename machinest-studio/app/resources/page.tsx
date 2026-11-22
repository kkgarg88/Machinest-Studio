import { createClient } from '@/lib/supabase/server'
import ResourcesView, { type Resource } from './ResourcesView'

// Rendered on the server so Google reads the real resource list, not a "Loading..." screen.
export default async function ResourcesPage() {
  const supabase = await createClient()

  // Visitors can browse the free resources without logging in
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('resources')
    .select('id, title, description, resource_type, url, category, thumbnail_url')
    .eq('active', true)
    .order('display_order', { ascending: true })

  const resources = (data || []) as Resource[]

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Free CNC Resources',
    url: 'https://app.machinest.in/resources',
    description: 'Free videos, Excel sheets, PDFs and calculators for everyone in manufacturing: CNC programmers, setters, operators, quality and maintenance teams, and students.',
    isPartOf: { '@type': 'WebSite', name: 'Machinest Studio', url: 'https://app.machinest.in' },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: resources.length,
      itemListElement: resources.map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: r.title,
        url: r.url,
      })),
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <ResourcesView resources={resources} loggedIn={!!user} />
    </>
  )
}
