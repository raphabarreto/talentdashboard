import { getSession, onAuthChange } from './lib/auth'
import { getStreamers, getCampaigns } from './lib/data'
import { setStreamers, setCampaigns } from './state'
import { renderOverview } from './ui/overview'
import { renderTable } from './ui/table'
import { renderCampaigns } from './ui/campaigns'
import { setupAutocomplete, getExistingCompanies } from './ui/filters'
import { setupProspecting } from './ui/prospecting'
import { setupNav, setupFiltersAndSort, setupGlobalEvents, placeLookupBar } from './events/navigation'
import { setupStreamersEvents } from './events/streamers'
import { setupCampaignsEvents } from './events/campaigns'
import * as Sentry from '@sentry/browser'
import { showLoadError } from './ui/loadError'
import { logError } from './lib/logger'
import './style.css'

// Inicializar Sentry em produção
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    tunnel: '/api/sentry-tunnel', // envia pelo próprio domínio (bloqueadores de anúncio barram *.sentry.io)
    tracesSampleRate: 0.1, // 10% das transações
  })
}

async function loadData() {
  const [s, c] = await Promise.all([getStreamers(), getCampaigns()])
  setStreamers(s)
  setCampaigns(c)
}

function renderAll() {
  renderOverview()
  renderTable()
  renderCampaigns()
}

async function init() {
  // Só esta parte depende da rede: se falhar, mostra o aviso com "Tentar novamente" (nada de tela eterna).
  try {
    const session = await getSession()
    if (!session) { window.location.href = '/login.html'; return }
    await loadData()
  } catch (err) {
    logError(err, 'Falha no carregamento inicial')
    showLoadError(init)
    return
  }
  setupNav()
  setupFiltersAndSort()
  setupGlobalEvents()
  setupStreamersEvents({ loadData, renderAll, renderTable })
  setupCampaignsEvents({ loadData, renderAll })
  setupProspecting()
  placeLookupBar() // a aba Prospecção só existe agora; reposiciona o campo se ela estiver ativa
  setupAutocomplete('companyInput', 'companySuggestions', getExistingCompanies)
  renderAll()
  document.getElementById('loading-overlay')?.classList.add('hidden')
}

onAuthChange((loggedIn) => { if (!loggedIn) window.location.href = '/login.html' })
init()
