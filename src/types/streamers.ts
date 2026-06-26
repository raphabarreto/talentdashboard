// Types relacionados a streamers
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
  is_live?: boolean
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
