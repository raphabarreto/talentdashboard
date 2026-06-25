import { signOut } from '../lib/auth'
import { currentSort, setOverviewPage, setTablePage } from '../state'
import { confirmAction } from '../utils'
import { renderOverview } from '../ui/overview'
import { renderTable } from '../ui/table'
import { renderCampaigns } from '../ui/campaigns'

export function setupNav() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const viewId = (link as HTMLElement).dataset.view!
      sessionStorage.setItem('activeTab', viewId)
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== `view-${viewId}`))
      document.querySelectorAll('.nav-link').forEach(l => {
        const active = (l as HTMLElement).dataset.view === viewId
        l.classList.toggle('border-indigo-500', active)
        l.classList.toggle('text-indigo-400', active)
        l.classList.toggle('border-transparent', !active)
        l.classList.toggle('text-slate-400', !active)
      })
      const streamerBtns = viewId === 'overview' || viewId === 'table'
      const campaignBtn = viewId === 'campaigns'
      document.getElementById('addMultipleBtn')!.classList.toggle('hidden', !streamerBtns)
      document.getElementById('openAddStreamer')!.classList.toggle('hidden', !streamerBtns)
      document.getElementById('openAddCampaign')!.classList.toggle('hidden', !campaignBtn)
    })
  })
  const saved = sessionStorage.getItem('activeTab')
  const target = saved ? document.querySelector(`.nav-link[data-view="${saved}"]`) : document.querySelector('.nav-link')
  target?.dispatchEvent(new Event('click'))
}

export function setupFiltersAndSort() {
  // Overview filters
  ;['search-overview', 'country-filter', 'status-filter-overview', 'category-filter-overview'].forEach(id => {
    const el = document.getElementById(id)
    el?.addEventListener('input', () => { setOverviewPage(1); renderOverview() })
    if (el?.tagName === 'SELECT') el.addEventListener('change', () => { setOverviewPage(1); renderOverview() })
  })
  // Table filters
  ;['search-table', 'country-filter-table', 'status-filter-table', 'category-filter-table'].forEach(id => {
    const el = document.getElementById(id)
    el?.addEventListener('input', () => { setTablePage(1); renderTable() })
    if (el?.tagName === 'SELECT') el.addEventListener('change', () => { setTablePage(1); renderTable() })
  })
  // Campaign filters
  ;['month-filter', 'year-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderCampaigns)
  })
  // Sort headers
  document.querySelectorAll('[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = (th as HTMLElement).dataset.sort!
      if (currentSort.key === key) currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc'
      else { currentSort.key = key; currentSort.order = 'desc' }
      renderTable()
    })
  })
}

export function setupGlobalEvents() {
  // Close modals on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'))
  })
  // Close history modal
  document.getElementById('closeHistoryModal')?.addEventListener('click', () => document.getElementById('historyModal')!.classList.add('hidden'))
  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (await confirmAction('Deseja sair?', 'Sair')) signOut()
  })
}
