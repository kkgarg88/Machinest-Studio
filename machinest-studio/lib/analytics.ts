// Sends a custom event to Google Analytics 4. Does nothing if GA is not loaded
// (local development, ad blockers), so it can never break a page.
type Params = Record<string, string | number | boolean | undefined | Record<string, string | number>[]>

export function track(event: string, params: Params = {}) {
  try {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void }
    if (typeof w.gtag === 'function') w.gtag('event', event, params)
  } catch {
    // analytics must never affect the app
  }
}
