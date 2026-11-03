import { describe, it, expect, vi, beforeEach } from 'vitest'

const addStreamer = vi.fn()
const addStreamers = vi.fn()
const updateLastLive = vi.fn()
const fetchStreamerLookup = vi.fn()
const fetchInitialStats = vi.fn()

vi.mock('../lib/data', () => ({
  addStreamer: (...a: unknown[]) => addStreamer(...a),
  addStreamers: (...a: unknown[]) => addStreamers(...a),
  updateLastLive: (...a: unknown[]) => updateLastLive(...a),
}))
vi.mock('../lib/twitch', () => ({
  fetchStreamerLookup: (...a: unknown[]) => fetchStreamerLookup(...a),
  fetchInitialStats: (...a: unknown[]) => fetchInitialStats(...a),
}))

import { buildStreamerRow, prepareStreamerData, registerStreamer, registerStreamersBatch } from '../lib/registration'

beforeEach(() => { [addStreamer, addStreamers, updateLastLive, fetchStreamerLookup, fetchInitialStats].forEach(m => m.mockReset()) })

const user = { display_name: 'Foo', broadcaster_language: 'pt-br' }

describe('buildStreamerRow', () => {
  it('converte idioma em país e preenche estatísticas', () => {
    expect(buildStreamerRow(user, { avg_viewers: 10, peak_viewers: 20, hours_watched: 30, hours_streamed: 40 }))
      .toEqual({ name: 'Foo', country: 'br', avg_viewers: 10, peak_viewers: 20, hours_watched: 30, hours_streamed: 40 })
  })
  it('sem stats ou idioma desconhecido usa zeros e país vazio', () => {
    expect(buildStreamerRow({ display_name: 'X', broadcaster_language: 'xx' }, null))
      .toEqual({ name: 'X', country: '', avg_viewers: 0, peak_viewers: 0, hours_watched: 0, hours_streamed: 0 })
  })
})

describe('prepareStreamerData', () => {
  it('falha quando o streamer não existe', async () => {
    fetchStreamerLookup.mockResolvedValue({ user: null, lastLive: null })
    fetchInitialStats.mockResolvedValue(null)
    await expect(prepareStreamerData('nada')).rejects.toThrow('Streamer não encontrado.')
  })
  it('junta lookup e stats', async () => {
    fetchStreamerLookup.mockResolvedValue({ user, lastLive: '2026-01-01T00:00:00Z' })
    fetchInitialStats.mockResolvedValue({ avg_viewers: 5, peak_viewers: 6, hours_watched: 7, hours_streamed: 8 })
    const r = await prepareStreamerData('foo')
    expect(r.streamerData.avg_viewers).toBe(5)
    expect(r.lastLive).toBe('2026-01-01T00:00:00Z')
  })
})

describe('registerStreamer', () => {
  const row = buildStreamerRow(user, null)
  it('usa o id devolvido pelo insert para gravar a última live', async () => {
    addStreamer.mockResolvedValue({ id: 'abc', name: 'Foo' })
    const r = await registerStreamer({ streamerData: row, lastLive: 'L' })
    expect(updateLastLive).toHaveBeenCalledWith('abc', 'L')
    expect(r.lastLiveSaved).toBe(true)
  })
  it('sem última live não chama updateLastLive', async () => {
    addStreamer.mockResolvedValue({ id: 'abc' })
    await registerStreamer({ streamerData: row, lastLive: null })
    expect(updateLastLive).not.toHaveBeenCalled()
  })
  it('falha na última live não desfaz o cadastro', async () => {
    addStreamer.mockResolvedValue({ id: 'abc' })
    updateLastLive.mockRejectedValue(new Error('x'))
    const r = await registerStreamer({ streamerData: row, lastLive: 'L' })
    expect(r.lastLiveSaved).toBe(false)
    expect(r.streamer.id).toBe('abc')
  })
  it('erro no insert é propagado', async () => {
    addStreamer.mockRejectedValue(new Error('dup'))
    await expect(registerStreamer({ streamerData: row, lastLive: 'L' })).rejects.toThrow('dup')
  })
})

describe('registerStreamersBatch', () => {
  it('grava lives pelos ids devolvidos e conta falhas', async () => {
    addStreamers.mockResolvedValue([{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }])
    updateLastLive.mockImplementation(async (id: string) => { if (id === '2') throw new Error('x') })
    const mk = (name: string, lastLive: string | null) => ({ streamerData: buildStreamerRow({ display_name: name, broadcaster_language: 'en' }, null), lastLive })
    const r = await registerStreamersBatch([mk('A', 'L1'), mk('B', 'L2'), mk('C', null)])
    expect(updateLastLive).toHaveBeenCalledTimes(2)
    expect(r.lastLiveFailures).toBe(1)
    expect(r.inserted).toHaveLength(3)
  })
})
