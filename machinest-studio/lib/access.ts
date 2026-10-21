import 'server-only'
import { SupabaseClient } from '@supabase/supabase-js'

export async function hasCycleAccess(
  supabase: SupabaseClient,
  userId: string,
  cycleId: string,
  toolId: string
): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', userId).maybeSingle()
  if (profile?.is_admin) return true

  const { data: freeCycle } = await supabase.from('free_cycles').select('id').eq('cycle_id', cycleId).maybeSingle()
  if (freeCycle) return true

  const nowIso = new Date().toISOString()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('tool_id', toolId)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle()

  return !!sub
}