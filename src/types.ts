export interface Streamer {
  id: string
  name: string
  country: string
  avg_viewers: number
  peak_viewers: number
  hours_watched: number
  hours_streamed: number
  is_active: boolean
  game_name: string
  created_at: string
}

export interface StreamerHistory {
  id: string
  streamer_id: string
  month: string
  avg_viewers: number
  peak_viewers: number
  hours_watched: number
  hours_streamed: number
  created_at: string
}

export interface StreamSnapshot {
  id: string
  streamer_id: string
  viewers: number
  is_live: boolean
  game: string
  captured_at: string
}

export interface Campaign {
  id: string
  company: string
  start_date: string
  end_date: string
  created_at: string
  campaign_streamers?: CampaignStreamer[]
}

export interface CampaignStreamer {
  id: string
  campaign_id: string
  streamer_name: string
  payment: number
  payment_date: string | null
}
