import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL. Set it in .env.local and restart Vite.')
}

let parsedUrl
try {
  parsedUrl = new URL(supabaseUrl)
} catch {
  throw new Error('VITE_SUPABASE_URL must be a valid absolute URL.')
}

if (!['https:', 'http:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
  throw new Error('VITE_SUPABASE_URL must be an HTTP(S) URL without embedded credentials.')
}

if (!publishableKey) {
  throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY. Set it in .env.local and restart Vite.')
}

function isServiceRoleKey(key) {
  if (key.startsWith('sb_secret_')) return true

  const payload = key.split('.')[1]
  if (!payload || typeof globalThis.atob !== 'function') return false

  try {
    const decoded = globalThis.atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decoded).role === 'service_role'
  } catch {
    return false
  }
}

if (isServiceRoleKey(publishableKey)) {
  throw new Error('A service-role key cannot be used in frontend code. Use the Supabase publishable key.')
}

export const supabase = createClient(supabaseUrl, publishableKey)
