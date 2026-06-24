export interface Streamer {
  id: string
  name: string
  country: string
  avg_viewers: number
  peak_viewers: number
  hours_watched: number
  hours_streamed: number
  last_live_at: string | null
  main_category: string
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

export interface Campaign {
  id: string
  company: string
  start_date: string
  end_date: string
  campaign_value: number
  currency: 'BRL' | 'USD'
  my_commission: number
  payment_date: string | null
  created_at: string
  campaign_streamers?: CampaignStreamer[]
}

export type ContactStatus = 'pendente' | 'contatado' | 'confirmado' | 'recusado'

export interface CampaignStreamer {
  id: string
  campaign_id: string
  streamer_name: string
  payment: number
  payment_date: string | null
  contact_status?: ContactStatus
}
