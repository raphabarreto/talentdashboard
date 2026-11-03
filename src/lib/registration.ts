import { addStreamer, addStreamers, updateLastLive } from './data'
import { fetchInitialStats, fetchStreamerLookup } from './twitch'
import { langToCountry } from '../utils'

// Único lugar com a regra de "como um streamer da Twitch vira uma linha do banco".
// Usado pelo modal de busca, pelo cadastro em lote e pela confirmação de campanha.

export type TwitchLookupUser = NonNullable<Awaited<ReturnType<typeof fetchStreamerLookup>>['user']>
export type TwitchStats = Awaited<ReturnType<typeof fetchInitialStats>>

export interface StreamerRow {
  name: string
  country: string
  avg_viewers: number
  peak_viewers: number
  hours_watched: number
  hours_streamed: number
}

export function buildStreamerRow(user: Pick<TwitchLookupUser, 'display_name' | 'broadcaster_language'>, stats: TwitchStats | null | undefined): StreamerRow {
  const lang = user.broadcaster_language?.split('-')[0]
  return {
    name: user.display_name,
    country: (lang && langToCountry[lang]) || '',
    avg_viewers: stats?.avg_viewers || 0,
    peak_viewers: stats?.peak_viewers || 0,
    hours_watched: stats?.hours_watched || 0,
    hours_streamed: stats?.hours_streamed || 0,
  }
}

// Busca na Twitch (lookup) e no twitchtracker (stats) e monta a linha, sem gravar nada.
export async function prepareStreamerData(name: string) {
  const [{ user, lastLive }, stats] = await Promise.all([fetchStreamerLookup(name), fetchInitialStats(name)])
  if (!user) throw new Error('Streamer não encontrado.')
  return { user, streamerData: buildStreamerRow(user, stats), lastLive }
}
export type PreparedStreamer = Awaited<ReturnType<typeof prepareStreamerData>>

// Grava um streamer e, se houver, a data da última live (usando o id devolvido pelo insert).
// Falha ao gravar a última live não desfaz o cadastro: vem em lastLiveSaved=false.
export async function registerStreamer(prepared: Pick<PreparedStreamer, 'streamerData' | 'lastLive'>) {
  const streamer = await addStreamer(prepared.streamerData)
  let lastLiveSaved = true
  if (prepared.lastLive) {
    try { await updateLastLive(streamer.id, prepared.lastLive) } catch { lastLiveSaved = false }
  }
  return { streamer, lastLiveSaved }
}

// Versão em lote: insere todos e grava as últimas lives usando os ids devolvidos (sem reconsultar por nome).
export async function registerStreamersBatch(items: Array<{ streamerData: StreamerRow; lastLive: string | null }>) {
  const inserted = await addStreamers(items.map(i => i.streamerData))
  const idByName = new Map(inserted.map(s => [s.name, s.id]))
  let lastLiveFailures = 0
  for (const i of items) {
    const id = idByName.get(i.streamerData.name)
    if (!id || !i.lastLive) continue
    try { await updateLastLive(id, i.lastLive) } catch { lastLiveFailures++ }
  }
  return { inserted, lastLiveFailures }
}
