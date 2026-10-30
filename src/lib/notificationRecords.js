import { supabase } from './supabaseClient'

const NOTIFICATION_COLUMNS = 'id, title, message, notification_type, is_read, link, created_at'

export async function fetchRecentNotifications(limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
