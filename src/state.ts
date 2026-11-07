import type { Streamer, Campaign } from './types/index'
import { PAGE_SIZE } from './constants'

export let streamers: Streamer[] = []
export let campaigns: Campaign[] = []
export let currentSort = { key: 'avg_viewers', order: 'desc' as 'asc' | 'desc' }
export const selectedStreamers = new Set<string>()
export { PAGE_SIZE }
export let overviewPage = 1
export let tablePage = 1
export let editingCampaignId: string | null = null

export function setStreamers(s: Streamer[]) { 
  streamers = s
}
export function setCampaigns(c: Campaign[]) { campaigns = c }
export function setOverviewPage(p: number) { overviewPage = p }
export function setTablePage(p: number) { tablePage = p }
export function setEditingCampaignId(id: string | null) { editingCampaignId = id }

