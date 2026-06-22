import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://javnlhanjbkefzwiddww.supabase.co',
  'sb_publishable_cF5P7pkV_2oa3Gb7aCmHjQ_uLR3zYul'
)

const TWITCH_CLIENT_ID = '0a3mnlmypnfuh96z4mtasgvvetw4gr'
const TWITCH_CLIENT_SECRET = '2dtpml86ons4adrvge0q4uxykueefi'

const langToCountry: Record<string, string> = {
  pt: 'br', en: 'us', es: 'es', fr: 'fr', de: 'de',
  it: 'it', ja: 'jp', ko: 'kr', ru: 'ru', zh: 'cn',
  pl: 'pl', nl: 'nl', sv: 'se'
}

const streamers = [
  'v1tona', 'juankkj__', 'amandadetonatiii', 'dekotv_',
  'africaalbion', 'squirleytv', 'apo_wow', 'bingulz',
  'paulinhax', '1bladez', 'nautiluslink', 'gratis150ml',
  'tynnkz', 'juliabrantgg', 'pedrobananatft', 'filipoppy1', 'leonaticata'
]

async function main() {
  // Get Twitch token
  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`
  })
  const { access_token } = await tokenRes.json()

  for (const username of streamers) {
    try {
      // Fetch user
      const res = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
        headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${access_token}` }
      })
      const { data } = await res.json()
      const user = data?.[0]
      if (!user) { console.log(`❌ ${username} - não encontrado`); continue }

      // Fetch channel
      const chRes = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${user.id}`, {
        headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${access_token}` }
      })
      const chData = await chRes.json()
      const channel = chData.data?.[0]

      const lang = channel?.broadcaster_language?.split('-')[0]

      const { error } = await supabase.from('streamers').insert({
        name: user.display_name,
        country: (lang && langToCountry[lang]) || '',
        avg_viewers: 0,
        peak_viewers: 0,
        hours_watched: 0,
        hours_streamed: 0,
        is_active: true,
        game_name: channel?.game_name || ''
      })

      if (error) console.log(`❌ ${user.display_name} - ${error.message}`)
      else console.log(`✅ ${user.display_name}`)
    } catch (e) {
      console.log(`❌ ${username} - erro: ${e}`)
    }
  }
}

main()
