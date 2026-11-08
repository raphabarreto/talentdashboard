import { describe, it, expect } from 'vitest'
import { diffCampaignStreamers } from '../lib/campaignSync'

const ex = (id: string, name: string, st?: string) => ({ id, streamer_name: name, contact_status: st as never })
const row = (name: string, st?: string) => ({ streamer_name: name, payment: 0, payment_date: null, ...(st ? { contact_status: st as never } : {}) })

describe('diffCampaignStreamers', () => {
  it('lista igual: nada a fazer (ninguém é apagado e recriado)', () => {
    const d = diffCampaignStreamers([ex('1', 'ana', 'confirmado'), ex('2', 'bia', 'recusado')], [row('ana'), row('bia')])
    expect(d).toEqual({ toInsert: [], toUpdate: [], toDeleteIds: [], removedNames: [] })
  })

  it('só insere quem é novo (como pendente) e só remove quem saiu', () => {
    const d = diffCampaignStreamers([ex('1', 'ana', 'confirmado'), ex('2', 'bia')], [row('ana'), row('caio')])
    expect(d.toInsert.map(r => [r.streamer_name, r.contact_status])).toEqual([['caio', 'pendente']])
    expect(d.toDeleteIds).toEqual(['2'])
    expect(d.removedNames).toEqual(['bia'])
    expect(d.toUpdate).toEqual([])
  })

  it('comparação ignora maiúsculas e espaços; ajusta a grafia sem mudar o status', () => {
    const d = diffCampaignStreamers([ex('1', 'Ana', 'contatado')], [row(' ANA ')])
    expect(d.toInsert).toEqual([])
    expect(d.toDeleteIds).toEqual([])
    expect(d.toUpdate).toEqual([{ id: '1', patch: { streamer_name: ' ANA ' } }])
  })

  it('"já confirmados" muda o status de quem já estava; sem a opção, o status é preservado', () => {
    const existing = [ex('1', 'ana', 'contatado'), ex('2', 'bia', 'recusado')]
    const withFlag = diffCampaignStreamers(existing, [row('ana', 'confirmado'), row('bia', 'confirmado')])
    expect(withFlag.toUpdate).toEqual([{ id: '1', patch: { contact_status: 'confirmado' } }, { id: '2', patch: { contact_status: 'confirmado' } }])
    expect(diffCampaignStreamers(existing, [row('ana'), row('bia')]).toUpdate).toEqual([])
  })

  it('novos com a opção "já confirmados" entram confirmados', () => {
    const d = diffCampaignStreamers([], [row('ana', 'confirmado')])
    expect(d.toInsert[0].contact_status).toBe('confirmado')
  })

  it('nomes repetidos na lista nova entram uma vez só', () => {
    expect(diffCampaignStreamers([], [row('ana'), row('ANA')]).toInsert).toHaveLength(1)
  })

  it('duplicatas antigas no banco não são apagadas sem pedido', () => {
    const d = diffCampaignStreamers([ex('1', 'ana'), ex('2', 'ana')], [row('ana')])
    expect(d.toDeleteIds).toEqual([])
  })

  it('lista nova vazia remove todos (e informa quem)', () => {
    const d = diffCampaignStreamers([ex('1', 'ana'), ex('2', 'bia')], [])
    expect(d.toDeleteIds).toEqual(['1', '2'])
    expect(d.removedNames).toEqual(['ana', 'bia'])
  })
})
