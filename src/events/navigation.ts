import { signOut } from '../lib/auth'
import { currentSort, setOverviewPage, setTablePage } from '../state'
import { confirmAction, debounce } from '../utils'
import { DEBOUNCE_SEARCH_MS } from '../constants'
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
      const actionsGroup = document.getElementById('streamerActionsTemplate')!
      if (streamerBtns) {
        const slot = document.getElementById(`streamerActionsSlot-${viewId}`)!
        slot.appendChild(actionsGroup)
        actionsGroup.classList.remove('hidden')
      } else {
        actionsGroup.classList.add('hidden')
      }
    })
  })
  const saved = sessionStorage.getItem('activeTab')
  const target = saved ? document.querySelector(`.nav-link[data-view="${saved}"]`) : document.querySelector('.nav-link')
  target?.dispatchEvent(new Event('click'))
}

export function setupFiltersAndSort() {
  // Debounced render functions
  const debouncedRenderOverview = debounce(() => { setOverviewPage(1); renderOverview() }, DEBOUNCE_SEARCH_MS)
  const debouncedRenderTable = debounce(() => { setTablePage(1); renderTable() }, DEBOUNCE_SEARCH_MS)

  // Overview filters
  document.getElementById('search-overview')?.addEventListener('input', debouncedRenderOverview)
  ;['country-filter', 'status-filter-overview', 'category-filter-overview'].forEach(id => {
    const el = document.getElementById(id)
    el?.addEventListener('change', () => { setOverviewPage(1); renderOverview() })
  })
  
  // Table filters
  document.getElementById('search-table')?.addEventListener('input', debouncedRenderTable)
  ;['country-filter-table', 'status-filter-table', 'category-filter-table'].forEach(id => {
    const el = document.getElementById(id)
    el?.addEventListener('change', () => { setTablePage(1); renderTable() })
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
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'))
      // Fechar dropdowns também
      document.querySelectorAll('.dropdown-menu:not(.hidden)').forEach(d => d.classList.add('hidden'))
    }
    
    // Ctrl/Cmd + K para focar busca
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      const activeView = document.querySelector('.view:not(.hidden)')
      const searchInput = activeView?.querySelector('input[type="text"]') as HTMLInputElement
      searchInput?.focus()
    }
  })
  
  // Close dropdown menus when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.dropdown-menu') && !target.closest('button')) {
      document.querySelectorAll('.dropdown-menu:not(.hidden)').forEach(d => d.classList.add('hidden'))
    }
  })
  
  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    if (await confirmAction('Deseja sair?', 'Sair')) signOut()
  })
}
