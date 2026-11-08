import type { CampaignStreamer, ContactStatus } from '../types/index'

// Sincronização dos participantes de uma campanha por DIFERENÇA: só insere quem é novo, só remove quem saiu
// e só altera quem mudou. Quem continua na lista nunca é apagado e recriado (status e ids se preservam).

export type StreamerRow = Omit<CampaignStreamer, 'id' | 'campaign_id'>
export interface ExistingRow { id: string; streamer_name: string; contact_status?: ContactStatus | null }
export interface RowUpdate { id: string; patch: { streamer_name?: string; contact_status?: ContactStatus } }
export interface StreamerDiff { toInsert: StreamerRow[]; toUpdate: RowUpdate[]; toDeleteIds: string[]; removedNames: string[] }

const keyOf = (name: string) => name.trim().toLowerCase()

export function diffCampaignStreamers(existing: ExistingRow[], desired: StreamerRow[]): StreamerDiff {
  const desiredByKey = new Map<string, StreamerRow>()
  for (const row of desired) {
    const key = keyOf(row.streamer_name)
    if (key && !desiredByKey.has(key)) desiredByKey.set(key, row)
  }

  const existingKeys = new Set<string>()
  const toUpdate: RowUpdate[] = []
  const toDeleteIds: string[] = []
  const removedNames: string[] = []

  for (const e of existing) {
    const key = keyOf(e.streamer_name)
    const want = desiredByKey.get(key)
    if (!want) { toDeleteIds.push(e.id); removedNames.push(e.streamer_name); continue }
    if (existingKeys.has(key)) continue // duplicata antiga: não mexe (nada é apagado sem o usuário pedir)
    existingKeys.add(key)
    const patch: RowUpdate['patch'] = {}
    if (want.streamer_name !== e.streamer_name) patch.streamer_name = want.streamer_name
    if (want.contact_status && want.contact_status !== (e.contact_status || 'pendente')) patch.contact_status = want.contact_status
    if (Object.keys(patch).length) toUpdate.push({ id: e.id, patch })
  }

  const toInsert = [...desiredByKey.entries()]
    .filter(([key]) => !existingKeys.has(key))
    .map(([, row]) => ({ ...row, contact_status: row.contact_status || ('pendente' as ContactStatus) }))

  return { toInsert, toUpdate, toDeleteIds, removedNames }
}
