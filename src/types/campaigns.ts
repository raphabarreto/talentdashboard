// Types relacionados a campanhas
export type ContactStatus = 'pendente' | 'contatado' | 'nao_respondeu' | 'confirmado' | 'recusado'

export interface Campaign {
  id: string
  company: string
  start_date: string
  end_date: string
  total_received: number
  my_commission: number
  currency: 'BRL' | 'USD'
  payment_date: string | null
  created_at: string
  campaign_streamers?: CampaignStreamer[]
}

export interface CampaignStreamer {
  id: string
  campaign_id: string
  streamer_name: string
  payment: number
  payment_date: string | null
  contact_status?: ContactStatus
}
