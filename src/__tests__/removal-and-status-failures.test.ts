import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  deleteStreamer: vi.fn(),
  deleteStreamers: vi.fn(),
  deleteCampaign: vi.fn(),
  updateContactStatus: vi.fn(),
  confirm: vi.fn(),
  toast: vi.fn(),
}))
vi.mock('../lib/data', () => ({
  deleteStreamer: h.deleteStreamer, deleteStreamers: h.deleteStreamers, deleteCampaign: h.deleteCampaign,
  updateContactStatus: h.updateContactStatus, getStreamers: vi.fn().mockResolvedValue([]),
  addProspectRow: vi.fn(), getProspectShortlist: vi.fn(), replaceProspectShortlist: vi.fn(),
}))
vi.mock('../lib/registration', () => ({ prepareStreamerData: vi.fn(), registerStreamer: vi.fn(), buildStreamerRow: vi.fn(), registerStreamersBatch: vi.fn() }))
vi.mock('../lib/twitch', () => ({ fetchTwitchUsers: vi.fn(), fetchInitialStats: vi.fn(), fetchLastLiveDate: vi.fn() }))
vi.mock('../lib/logger', () => ({ logError: vi.fn(), setButtonLoading: vi.fn() }))
vi.mock('../utils', async (orig) => ({ ...(await orig<typeof import('../utils')>()), showToast: h.toast, confirmAction: h.confirm }))

import { setupStreamersEvents } from '../events/streamers'
import { setupCampaignsEvents } from '../events/campaigns'
import { setStreamers, setCampaigns, selectedStreamers, streamers, campaigns } from '../state'

const mkStreamer = (id: string, name: string) => ({ id, name, country: '', avg_viewers: 1, peak_viewers: 1, hours_watched: 1, hours_streamed: 1, last_live_at: null, created_at: '' })
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

const renderAll = vi.fn()
const renderTable = vi.fn()
const loadData = vi.fn().mockResolvedValue(undefined)

let wired = false
beforeEach(() => {
  vi.clearAllMocks()
  // Os botões fixos (com ouvintes ligados uma vez) ficam fora do trecho que é recriado a cada teste.
  if (!document.getElementById('removeSelectedBtn')) {
    document.body.innerHTML = '<button id="removeSelectedBtn"></button><button id="overviewRemoveSelectedBtn"></button><div id="dyn"></div><div id="toast"><span id="toast-message"></span></div>'
  }
  document.getElementById('dyn')!.innerHTML = `
    <button class="delete-btn" id="del1" data-id="1"></button>
    <button class="delete-campaign-btn" id="delC" data-id="c1"></button>
    <div id="campaignDetailsModal" class="hidden"></div><textarea id="campaignStreamersInput"></textarea><div id="streamerSuggestions"></div>`
  setStreamers([mkStreamer('1', 'ana'), mkStreamer('2', 'bia')])
  selectedStreamers.clear(); selectedStreamers.add('1'); selectedStreamers.add('2')
  setCampaigns([{ id: 'c1', company: 'Acme', campaign_streamers: [] } as never])
  h.confirm.mockResolvedValue(true)
  h.deleteStreamer.mockResolvedValue(undefined); h.deleteStreamers.mockResolvedValue(undefined); h.deleteCampaign.mockResolvedValue(undefined)
  if (!wired) {
    // O módulo registra ouvintes no document; liga uma vez só (os botões são recriados a cada teste).
    setupStreamersEvents({ loadData, renderAll, renderTable })
    setupCampaignsEvents({ loadData, renderAll })
    wired = true
  }
})

describe('remoção de um streamer', () => {
  it('só some da tela depois que o banco confirmou', async () => {
    document.getElementById('del1')!.click(); await flush()
    expect(h.deleteStreamer).toHaveBeenCalledWith('1')
    expect(streamers.map(s => s.id)).toEqual(['2'])
    expect(renderAll).toHaveBeenCalled()
    expect(h.toast).toHaveBeenCalledWith('Streamer removido!')
  })

  it('falha no banco: o streamer continua na lista, sem aviso falso de sucesso', async () => {
    h.deleteStreamer.mockRejectedValue(new Error('rede'))
    document.getElementById('del1')!.click(); await flush()
    expect(streamers.map(s => s.id)).toEqual(['1', '2'])
    expect(renderAll).not.toHaveBeenCalled()
    expect(h.toast).not.toHaveBeenCalledWith('Streamer removido!')
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining('Nada foi alterado'), 'error')
  })

  it('cancelar a confirmação não apaga nada', async () => {
    h.confirm.mockResolvedValue(false)
    document.getElementById('del1')!.click(); await flush()
    expect(h.deleteStreamer).not.toHaveBeenCalled()
    expect(streamers).toHaveLength(2)
  })
})

describe('remoção em massa', () => {
  it('sucesso: remove os selecionados e limpa a seleção', async () => {
    document.getElementById('removeSelectedBtn')!.click(); await flush()
    expect(h.deleteStreamers).toHaveBeenCalledWith(['1', '2'])
    expect(streamers).toHaveLength(0)
    expect(selectedStreamers.size).toBe(0)
  })

  it('falha: a lista e a seleção continuam como estavam', async () => {
    h.deleteStreamers.mockRejectedValue(new Error('rede'))
    document.getElementById('removeSelectedBtn')!.click(); await flush()
    expect(streamers).toHaveLength(2)
    expect([...selectedStreamers]).toEqual(['1', '2'])
    expect(h.toast).not.toHaveBeenCalledWith('Streamers removidos!')
  })
})

describe('exclusão de campanha', () => {
  it('falha no banco: a campanha continua na lista', async () => {
    h.deleteCampaign.mockRejectedValue(new Error('rede'))
    document.getElementById('delC')!.click(); await flush()
    expect(campaigns.map(c => c.id)).toEqual(['c1'])
    expect(h.toast).not.toHaveBeenCalledWith('Campanha removida!')
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining('Nada foi alterado'), 'error')
  })

  it('sucesso: some da lista', async () => {
    document.getElementById('delC')!.click(); await flush()
    expect(campaigns).toHaveLength(0)
    expect(h.toast).toHaveBeenCalledWith('Campanha removida!')
  })
})

describe('remoção em andamento: feedback e proteção contra clique duplo', () => {
  let release!: () => void
  let fail!: () => void
  const pending = () => new Promise<void>((res, rej) => { release = res; fail = () => rej(new Error('rede')) })
  const feedback = () => document.getElementById('toast-message')!.textContent

  it('mostra "Removendo...", trava o botão e ignora o segundo clique enquanto o banco não responde', async () => {
    h.deleteStreamer.mockReturnValue(pending())
    const btn = document.getElementById('del1') as HTMLButtonElement
    btn.click(); await flush()
    expect(feedback()).toBe('Removendo...')
    expect(btn.disabled).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
    document.getElementById('del1')!.click(); document.getElementById('removeSelectedBtn')!.click(); await flush()
    expect(h.confirm).toHaveBeenCalledTimes(1) // não pergunta de novo
    expect(h.deleteStreamer).toHaveBeenCalledTimes(1)
    expect(h.deleteStreamers).not.toHaveBeenCalled()
    expect(streamers).toHaveLength(2) // ainda não foi confirmado pelo banco
    release(); await flush()
    expect(streamers.map(s => s.id)).toEqual(['2'])
    expect(btn.disabled).toBe(false)
  })

  it('falha: libera o botão, mantém os dados e permite tentar de novo', async () => {
    h.deleteStreamer.mockReturnValueOnce(pending())
    const btn = document.getElementById('del1') as HTMLButtonElement
    btn.click(); await flush()
    fail(); await flush()
    expect(streamers).toHaveLength(2)
    expect(btn.disabled).toBe(false)
    expect(btn.hasAttribute('aria-busy')).toBe(false)
    expect(h.toast).toHaveBeenCalledWith(expect.stringContaining('Nada foi alterado'), 'error')
    btn.click(); await flush()
    expect(h.deleteStreamer).toHaveBeenCalledTimes(2)
    expect(streamers.map(s => s.id)).toEqual(['2'])
  })

  it('remoção em massa: botões travados durante a operação e liberados no fim', async () => {
    h.deleteStreamers.mockReturnValue(pending())
    const bulk = document.getElementById('removeSelectedBtn') as HTMLButtonElement
    bulk.click(); await flush()
    expect(feedback()).toBe('Removendo 2 streamers...')
    expect(bulk.disabled).toBe(true)
    bulk.click(); await flush()
    expect(h.deleteStreamers).toHaveBeenCalledTimes(1)
    release(); await flush()
    expect(bulk.disabled).toBe(false)
    expect(streamers).toHaveLength(0)
  })
})
