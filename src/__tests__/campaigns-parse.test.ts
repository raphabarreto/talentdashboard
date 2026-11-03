import { describe, it, expect } from 'vitest'
import { parseMoney, parseStreamerLines } from '../events/campaigns/parse'

describe('parseMoney', () => {
  it('converte formato brasileiro', () => {
    expect(parseMoney('1.234,56')).toBe(1234.56)
    expect(parseMoney('500')).toBe(500)
    expect(parseMoney('0,5')).toBe(0.5)
  })
  it('vazio ou inválido vira 0', () => {
    expect(parseMoney('')).toBe(0)
    expect(parseMoney('abc')).toBe(0)
  })
})

describe('parseStreamerLines', () => {
  it('uma linha por streamer, ignorando linhas vazias', () => {
    const r = parseStreamerLines('ana\n\n  bob  \n', false)
    expect(r.map(x => x.streamer_name)).toEqual(['ana', 'bob'])
    expect(r[0]).toEqual({ streamer_name: 'ana', payment: 0, payment_date: null })
  })
  it('aceita "nome: algo" e "nome - $valor"', () => {
    const r = parseStreamerLines('carla: 100\ndavi - $200', false)
    expect(r.map(x => x.streamer_name)).toEqual(['carla', 'davi'])
  })
  it('já confirmados recebem o status confirmado', () => {
    const r = parseStreamerLines('ana', true)
    expect(r[0].contact_status).toBe('confirmado')
  })
})
