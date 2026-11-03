import { searchCategories } from '../../lib/twitch'

// Cache de buscas de categoria: em memória (sessão) + localStorage (7 dias; ids de categoria da Twitch são estáveis).
export type Category = { id: string; name: string; box_art_url: string }
const CATEGORY_CACHE_KEY = 'prospectCategoryCache'
const CATEGORY_CACHE_TTL = 7 * 24 * 60 * 60 * 1000
const categorySearchCache = new Map<string, Category[]>()
const categoryInflight = new Map<string, Promise<Category[]>>()

function readStoredCategories(key: string): Category[] | null {
  try {
    const all = JSON.parse(localStorage.getItem(CATEGORY_CACHE_KEY) || '{}')
    const hit = all[key]
    return hit && Date.now() - hit.t < CATEGORY_CACHE_TTL ? hit.cats : null
  } catch { return null }
}

function storeCategories(key: string, cats: Category[]) {
  try {
    const all = JSON.parse(localStorage.getItem(CATEGORY_CACHE_KEY) || '{}')
    all[key] = { t: Date.now(), cats }
    const keys = Object.keys(all)
    if (keys.length > 100) keys.sort((a, b) => all[a].t - all[b].t).slice(0, keys.length - 100).forEach(k => delete all[k])
    localStorage.setItem(CATEGORY_CACHE_KEY, JSON.stringify(all))
  } catch { /* cache é só otimização */ }
}

export async function searchCategoriesCached(query: string): Promise<Category[]> {
  const key = query.toLowerCase()
  const mem = categorySearchCache.get(key)
  if (mem) return mem
  const stored = readStoredCategories(key)
  if (stored) { categorySearchCache.set(key, stored); return stored }
  const inflight = categoryInflight.get(key)
  if (inflight) return inflight
  const p = searchCategories(query).then(cats => {
    categorySearchCache.set(key, cats)
    if (cats.length) storeCategories(key, cats)
    return cats
  }).finally(() => categoryInflight.delete(key))
  categoryInflight.set(key, p)
  return p
}

export function isCategoryCached(query: string) {
  return categorySearchCache.has(query.toLowerCase())
}
