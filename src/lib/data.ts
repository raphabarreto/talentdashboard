import { supabase } from './supabase'
import type { Streamer, Campaign, CampaignStreamer, ContactStatus } from '../types/index'

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

export async function updateStreamer(id: string, updates: Partial<Streamer>) {
  const { error } = await supabase.from('streamers').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteStreamer(id: string) {
  const { error } = await supabase.from('streamers').delete().eq('id', id)
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
  if (error) throw error
  return data as Campaign[]
}

export async function addCampaign(campaign: Omit<Campaign, 'id' | 'created_at' | 'campaign_streamers'>, streamers: Omit<CampaignStreamer, 'id' | 'campaign_id'>[]) {
  const { data, error } = await supabase.from('campaigns').insert(campaign).select().single()
  if (error) throw error
  if (streamers.length > 0) {
    const rows = streamers.map(s => ({ ...s, campaign_id: data.id }))
    const { error: sErr } = await supabase.from('campaign_streamers').insert(rows)
    if (sErr) throw sErr
  }
  return data as Campaign
}

export async function updateCampaign(id: string, campaign: Partial<Campaign>, streamers?: Omit<CampaignStreamer, 'id' | 'campaign_id'>[]) {
  const { error } = await supabase.from('campaigns').update(campaign).eq('id', id)
  if (error) throw error
  if (streamers) {
    const { data: existing } = await supabase.from('campaign_streamers').select('streamer_name, contact_status').eq('campaign_id', id)
    const statusMap = new Map((existing || []).map(e => [e.streamer_name.toLowerCase(), e.contact_status]))
    await supabase.from('campaign_streamers').delete().eq('campaign_id', id)
    if (streamers.length > 0) {
      const rows = streamers.map(s => ({ ...s, campaign_id: id, contact_status: s.contact_status || statusMap.get(s.streamer_name.toLowerCase()) || 'pendente' }))
      await supabase.from('campaign_streamers').insert(rows)
    }
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