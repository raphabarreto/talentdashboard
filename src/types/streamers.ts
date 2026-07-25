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
  created_at: string
  is_live?: boolean
}
