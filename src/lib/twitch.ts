import { supabase } from './supabase'
import { log } from './logger'

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

export async function fetchTwitchUsers(logins: string[]) {
  if (!logins.length) return []
  return callProxy({ action: 'users', logins: logins.join(',') }) as Promise<Array<{
    id: string; login: string; display_name: string; profile_image_url: string
    broadcaster_language: string; game_name: string
  }>>
}

export async function fetchLastLiveDate(userId: string, login: string): Promise<string | null> {
  try {
    const video = await callProxy({ action: 'last_video', user_id: userId })
    if (video?.created_at) return video.created_at
    // Fallback: check if channel is live now
    const streams = await callProxy({ action: 'streams', usernames: login })
    if (Array.isArray(streams) && streams.length > 0) return new Date().toISOString()
    return null
  } catch { return null }
}

export async function fetchStreamerLookup(username: string): Promise<{
  user: {
    id: string; login: string; display_name: string; profile_image_url: string
    broadcaster_language: string; game_name: string
  } | null
  lastLive: string | null
}> {
  return callProxy({ action: 'lookup', username })
}

export async function searchCategories(query: string) {
  return callProxy({ action: 'search_categories', query }) as Promise<Array<{ id: string; name: string; box_art_url: string }>>
}

export async function fetchStreamsByGame(gameId: string, first = 100, language = '') {
  const params: Record<string, string> = { action: 'streams_by_game', game_id: gameId, first: String(first) }
  if (language) params.language = language
  return callProxy(params) as Promise<Array<{
    user_id: string; user_login: string; user_name: string; viewer_count: number; game_name: string
    language: string; title: string; tags: string[]
    user_info: { description: string; profile_image_url: string } | null
  }>>
}

export async function fetchInitialStats(username: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    // API nao oficial de terceiros: nome codificado na URL, tempo limite e falhas registradas (nao fatais).
    const res = await fetch(
      `https://twitchtracker.com/api/channels/summary/${encodeURIComponent(username.toLowerCase())}`,
      { signal: controller.signal }
    )
    if (!res.ok) {
      log('warn', 'twitchtracker respondeu com erro', { status: res.status })
      return null
    }
    const data = await res.json()
    return {
      avg_viewers: data.avg_viewers || 0,
      peak_viewers: data.max_viewers || 0,
      hours_watched: data.hours_watched || 0,
      hours_streamed: data.minutes_streamed ? Math.round(data.minutes_streamed / 60) : 0,
    }
  } catch (err) {
    log('warn', 'twitchtracker indisponivel', { error: String(err) })
    return null
  } finally {
    clearTimeout(timer)
  }
}
