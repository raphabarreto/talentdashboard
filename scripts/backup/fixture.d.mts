export function createFixture(): {
  format: number
  generated_at: string
  tables: Record<string, any[]> & { allowed_users: any[]; streamers: any[]; campaigns: any[]; campaign_streamers: any[]; prospect_shortlist: any[]; streamer_history: any[] }
  counts: Record<string, number>
}
