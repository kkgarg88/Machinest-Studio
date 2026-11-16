import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Records the FIRST time a user does something (for example, generates a cycle).
// Never throws: tracking must never break the real action.
export async function trackFirst(userId: string, event: string, meta?: Record<string, unknown>) {
  try {
    const admin = createAdminClient()
    await admin
      .from('user_events')
      .upsert({ user_id: userId, event, meta: meta ?? null }, { onConflict: 'user_id,event', ignoreDuplicates: true })
  } catch {
    // ignore
  }
}
