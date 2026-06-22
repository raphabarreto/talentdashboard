import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function callProxy(params: Record<string, string>) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado')

  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/twitch-proxy?${qs}`, {
    headers: { 'Authorization': `Bearer ${session.access_token}` }
  })
  if (!res.ok) throw new Error(`Twitch proxy error: ${res.status}`)
  return res.json()
}

export async function fetchTwitchUser(username: string) {
  return callProxy({ action: 'user', username })
}

export async function fetchLiveStreams(usernames: string[]) {
  if (!usernames.length) return []
  return callProxy({ action: 'streams', usernames: usernames.join(',') }) as Promise<Array<{
    user_login: string
    viewer_count: number
    game_name: string
  }>>
}

export async function fetchInitialStats(username: string) {
  try {
    const res = await fetch(`https://twitchtracker.com/api/channels/summary/${username.toLowerCase()}`)
    if (!res.ok) return null
    const data = await res.json()
    return {
      avg_viewers: data.avg_viewers || 0,
      peak_viewers: data.max_viewers || 0,
      hours_watched: data.hours_watched || 0,
      hours_streamed: data.minutes_streamed ? Math.round(data.minutes_streamed / 60) : 0,
    }
  } catch {
    return null
  }
}
