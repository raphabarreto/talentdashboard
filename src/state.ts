import type { Streamer, Campaign } from './types'

export let streamers: Streamer[] = []
export let campaigns: Campaign[] = []
export let currentSort = { key: 'avg_viewers', order: 'desc' as 'asc' | 'desc' }
export const selectedStreamers = new Set<string>()
export const PAGE_SIZE = 12
export let overviewPage = 1
export let tablePage = 1
export let editingCampaignId: string | null = null

// Cache de filtros
let cachedCountries: string[] = []
let cachedCategories: string[] = []
let cacheInvalidated = true

export function setStreamers(s: Streamer[]) { 
  streamers = s
  cacheInvalidated = true
}
export function setCampaigns(c: Campaign[]) { campaigns = c }
export function setOverviewPage(p: number) { overviewPage = p }
export function setTablePage(p: number) { tablePage = p }
export function setEditingCampaignId(id: string | null) { editingCampaignId = id }

export function getCachedCountries(): string[] {
  if (cacheInvalidated || cachedCountries.length === 0) {
    cachedCountries = [...new Set(streamers.map(s => s.country).filter(Boolean))].sort()
  }
  return cachedCountries
}

export function getCachedCategories(): string[] {
  if (cacheInvalidated || cachedCategories.length === 0) {
    cachedCategories = [...new Set(streamers.map(s => s.main_category).filter(Boolean))].sort()
    cacheInvalidated = false
  }
  return cachedCategories
}
