const TWITCH_CLIENT_ID = import.meta.env.VITE_TWITCH_CLIENT_ID
const TWITCH_CLIENT_SECRET = import.meta.env.VITE_TWITCH_CLIENT_SECRET

let token: string | null = null
let tokenExpiry = 0

export async function getTwitchToken(): Promise<string> {
  if (token && Date.now() < tokenExpiry) return token
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`
  })
  const data = await res.json()
  token = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return token!
}

export async function fetchTwitchUser(username: string) {
  const accessToken = await getTwitchToken()
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`, {
    headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
  })
  const data = await res.json()
  const user = data.data?.[0]
  if (!user) return null

  const chRes = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${user.id}`, {
    headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
  })
  const chData = await chRes.json()
  const channel = chData.data?.[0]

  return {
    ...user,
    broadcaster_language: channel?.broadcaster_language || '',
    game_name: channel?.game_name || ''
  }
}

export async function fetchLiveStreams(usernames: string[]) {
  const accessToken = await getTwitchToken()
  const params = usernames.map(u => `user_login=${encodeURIComponent(u)}`).join('&')
  const res = await fetch(`https://api.twitch.tv/helix/streams?${params}&first=100`, {
    headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
  })
  const data = await res.json()
  return data.data as Array<{
    user_login: string
    viewer_count: number
    game_name: string
  }>
}
