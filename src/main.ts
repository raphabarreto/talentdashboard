import { getSession, onAuthChange } from './lib/auth'
import { getStreamers, getCampaigns } from './lib/data'
import { setStreamers, setCampaigns } from './state'
import { renderOverview } from './ui/overview'
import { renderTable } from './ui/table'
import { renderCampaigns } from './ui/campaigns'
import { populateFilters, setupAutocomplete, getExistingCompanies } from './ui/filters'
import { setupProspecting } from './ui/prospecting'
import { setupNav, setupFiltersAndSort, setupGlobalEvents } from './events/navigation'
import { setupStreamersEvents } from './events/streamers'
import { setupCampaignsEvents } from './events/campaigns'
import * as Sentry from '@sentry/browser'
import './style.css'

// Inicializar Sentry em produção
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.1, // 10% das transações
  })
}

async function loadData() {
  const [s, c] = await Promise.all([getStreamers(), getCampaigns()])
  setStreamers(s)
  setCampaigns(c)
}

function renderAll() {
  populateFilters()
  renderOverview()
  renderTable()
  renderCampaigns()
}

async function init() {
  const session = await getSession()
  if (!session) { window.location.href = '/login.html'; return }
  await loadData()
  setupNav()
  setupFiltersAndSort()
  setupGlobalEvents()
  setupStreamersEvents({ loadData, renderAll, renderTable })
  setupCampaignsEvents({ loadData, renderAll })
  setupProspecting()
  setupAutocomplete('companyInput', 'companySuggestions', getExistingCompanies)
  renderAll()
  document.getElementById('loading-overlay')?.classList.add('hidden')
}

onAuthChange((loggedIn) => { if (!loggedIn) window.location.href = '/login.html' })
init()
