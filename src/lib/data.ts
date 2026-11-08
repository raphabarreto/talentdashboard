import { supabase } from './supabase'
import type { Streamer, Campaign, CampaignStreamer, ContactStatus } from '../types/index'
import { diffCampaignStreamers, type ExistingRow } from './campaignSync'

// --- STREAMERS ---
export async function getStreamers() {
  // Função RPC otimizada que retorna streamers + is_live em 1 query só
  // Reduz de 2 queries sequenciais para 1 query (~50-70% mais rápido)
  const { data, error } = await supabase.rpc('get_streamers_with_live_status')
  if (error) throw error
  
  return data as Streamer[]
}

export async function addStreamer(streamer: Omit<Streamer, 'id' | 'created_at' | 'last_live_at'>) {
  const { data, error } = await supabase.from('streamers').insert(streamer).select().single()
  if (error) throw error
  return data as Streamer
}

export async function addStreamers(streamers: Omit<Streamer, 'id' | 'created_at' | 'last_live_at'>[]) {
  if (!streamers.length) return []
  const { data, error } = await supabase.from('streamers').insert(streamers).select()
  if (error) throw error
  return data as Streamer[]
}

export async function deleteStreamer(id: string) {
  const { error } = await supabase.from('streamers').delete().eq('id', id)
  if (error) throw error
}

export async function deleteStreamers(ids: string[]) {
  if (!ids.length) return
  const { error } = await supabase.from('streamers').delete().in('id', ids)
  if (error) throw error
}

export async function updateLastLive(streamerId: string, lastLiveAt: string) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-last-live`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify({ streamer_id: streamerId, last_live_at: lastLiveAt })
  })
  if (!res.ok) throw new Error('Failed to update last_live_at')
}

// --- CAMPAIGNS ---
export async function getCampaigns() {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, campaign_streamers(*)')
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false }) // desempate fixo: contratos com a mesma data de início não trocam de lugar
  if (error) throw error
  return data as Campaign[]
}

export async function addCampaign(campaign: Omit<Campaign, 'id' | 'created_at' | 'campaign_streamers'>, streamers: Omit<CampaignStreamer, 'id' | 'campaign_id'>[]) {
  const { data, error } = await supabase.from('campaigns').insert(campaign).select().single()
  if (error) throw error
  if (streamers.length > 0) {
    const rows = streamers.map(s => ({ ...s, campaign_id: data.id }))
    const { error: sErr } = await supabase.from('campaign_streamers').insert(rows)
    if (sErr) {
      // A campanha acabou de nascer e não tem mais nada ligado a ela: desfaz a criação para que
      // tentar de novo não gere uma campanha duplicada e vazia.
      const { error: undoErr } = await supabase.from('campaigns').delete().eq('id', data.id)
      if (undoErr) throw new Error('A campanha foi criada, mas os streamers não puderam ser salvos. Abra a campanha e adicione-os novamente.')
      throw sErr
    }
  }
  return data as Campaign
}

// Atualiza os dados da campanha e, se vierem streamers, sincroniza a lista por diferença.
// Ordem pensada para nunca perder dados: o que é novo entra antes; o que saiu só é removido por último.
// Qualquer erro interrompe e é lançado (a tela nunca anuncia sucesso de algo que não foi gravado);
// repetir o salvamento é seguro, porque a diferença é recalculada a cada tentativa.
export async function updateCampaign(id: string, campaign: Partial<Campaign>, streamers?: Omit<CampaignStreamer, 'id' | 'campaign_id'>[]) {
  const { error } = await supabase.from('campaigns').update(campaign).eq('id', id)
  if (error) throw error
  if (!streamers) return

  const { data: existing, error: readErr } = await supabase.from('campaign_streamers').select('id, streamer_name, contact_status').eq('campaign_id', id)
  if (readErr) throw readErr
  const diff = diffCampaignStreamers((existing || []) as ExistingRow[], streamers)

  if (diff.toInsert.length) {
    const { error: insErr } = await supabase.from('campaign_streamers').insert(diff.toInsert.map(s => ({ ...s, campaign_id: id })))
    if (insErr) throw insErr
  }
  for (const u of diff.toUpdate) {
    const { error: upErr } = await supabase.from('campaign_streamers').update(u.patch).eq('id', u.id)
    if (upErr) throw upErr
  }
  if (diff.toDeleteIds.length) {
    const { error: delErr } = await supabase.from('campaign_streamers').delete().in('id', diff.toDeleteIds)
    if (delErr) throw delErr
  }
}

export async function deleteCampaign(id: string) {
  const { error } = await supabase.from('campaigns').delete().eq('id', id)
  if (error) throw error
}


export async function updateContactStatus(id: string, status: ContactStatus) {
  const { error } = await supabase.from('campaign_streamers').update({ contact_status: status }).eq('id', id)
  if (error) throw error
}
// --- PROSPECÇÃO (lista salva) ---
export interface ProspectRow { user_login: string; data: Record<string, unknown> }

export async function getProspectShortlist() {
  const { data, error } = await supabase.from('prospect_shortlist').select('user_login, data')
  if (error) throw error
  return (data || []) as ProspectRow[]
}

// Acrescenta (ou atualiza) um único item, sem apagar nada do resto da lista.
export async function addProspectRow(row: ProspectRow) {
  const { error } = await supabase.from('prospect_shortlist').upsert([row], { onConflict: 'user_login' })
  if (error) throw error
}

// Grava vários itens de uma vez (upsert). Nunca apaga nada.
export async function addProspectRows(rows: ProspectRow[]) {
  if (!rows.length) return
  const { error } = await supabase.from('prospect_shortlist').upsert(rows, { onConflict: 'user_login' })
  if (error) throw error
}

// Remove só o item pedido. (A lista nunca é "regravada por inteiro": uma cópia desatualizada no navegador
// não pode apagar do banco itens que ela desconhece.)
export async function deleteProspectRow(userLogin: string) {
  const { error } = await supabase.from('prospect_shortlist').delete().eq('user_login', userLogin)
  if (error) throw error
}

// Limpar a Minha Lista (ação explícita, já confirmada pelo usuário).
export async function clearProspectShortlist() {
  const { error } = await supabase.from('prospect_shortlist').delete().neq('user_login', '')
  if (error) throw error
}
