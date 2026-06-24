import { supabase } from './supabase'
import type { Streamer, StreamerHistory, Campaign, CampaignStreamer, ContactStatus } from '../types'

// --- STREAMERS ---
export async function getStreamers() {
  const { data, error } = await supabase.from('streamers').select('*').order('avg_viewers', { ascending: false })
  if (error) throw error
  return data as Streamer[]
}

export async function addStreamer(streamer: Omit<Streamer, 'id' | 'created_at' | 'last_live_at'>) {
  const { data, error } = await supabase.from('streamers').insert(streamer).select().single()
  if (error) throw error
  return data as Streamer
}

export async function updateStreamer(id: string, updates: Partial<Streamer>) {
  const { error } = await supabase.from('streamers').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteStreamer(id: string) {
  const { error } = await supabase.from('streamers').delete().eq('id', id)
  if (error) throw error
}

// --- HISTORY ---
export async function getStreamerHistory(streamerId: string) {
  const { data, error } = await supabase
    .from('streamer_history')
    .select('*')
    .eq('streamer_id', streamerId)
    .order('month', { ascending: false })
  if (error) throw error
  return data as StreamerHistory[]
}

export async function upsertHistory(entry: Omit<StreamerHistory, 'id' | 'created_at'>) {
  const { error } = await supabase
    .from('streamer_history')
    .upsert(entry, { onConflict: 'streamer_id,month' })
  if (error) throw error
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
      const rows = streamers.map(s => ({ ...s, campaign_id: id, contact_status: statusMap.get(s.streamer_name.toLowerCase()) || 'pendente' }))
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