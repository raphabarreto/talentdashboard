import { describe, it, expect } from 'vitest'
import { parseMoney, extractStreamerNames, toStreamerRows, mergeNames } from '../events/campaigns/parse'

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

describe('extractStreamerNames', () => {
  it('exemplo da empresa no Discord: ignora bandeira, país e valores', () => {
    const r = extractStreamerNames([
      '🇧🇷 Brazil',
      'clovaobengala - $300 + $2 USD per PC New User',
      'rafaao - $200 + $2 USD per PC New User',
      'jb_sniper - $150 + $2 USD per PC New User',
    ].join('\n'))
    expect(r.names).toEqual(['clovaobengala', 'rafaao', 'jb_sniper'])
    expect(r.ambiguous).toEqual([])
    expect(r.ignored).toEqual(['🇧🇷 Brazil'])
  })

  it('continua aceitando nomes simples, um por linha, ignorando linhas vazias', () => {
    const r = extractStreamerNames('ana\n\n  bob  \n')
    expect(r.names).toEqual(['ana', 'bob'])
    expect(r.ignored).toEqual([])
  })

  it('aceita "nome: algo" e "nome - $valor" como antes', () => {
    expect(extractStreamerNames('carla: 100\ndavi - $200').names).toEqual(['carla', 'davi'])
  })

  it('remove marcadores, numeração, links e menções', () => {
    const r = extractStreamerNames([
      '• Ana — https://www.twitch.tv/ana_tv',
      '1. bob_gamer - $100',
      '- @caio ($50)',
      'https://twitch.tv/dani_live',
      '* eva 300',
    ].join('\n'))
    expect(r.names).toEqual(['Ana', 'bob_gamer', 'caio', 'dani_live', 'eva'])
  })

  it('lê a lista copiada do próprio sistema (com países)', () => {
    const r = extractStreamerNames('🇧🇷 Brazil\n• Ana — https://www.twitch.tv/ana\n\n🇪🇸 Spain\n• Leo — https://www.twitch.tv/leo\n\n🌐 Others\n• Zed — https://www.twitch.tv/zed')
    expect(r.names).toEqual(['Ana', 'Leo', 'Zed'])
    expect(r.ignored).toHaveLength(3)
  })

  it('não cadastra cabeçalhos e informações comerciais como streamers', () => {
    const r = extractStreamerNames('Aprovados:\nTotal: $500\nValor - $300\nSpain\nOutros')
    expect(r.names).toEqual([])
    expect(r.ignored).toHaveLength(5)
  })

  it('mensagens longas da empresa são ignoradas', () => {
    const r = extractStreamerNames('Segue a lista aprovada para a campanha deste mês\nrafaao - $200')
    expect(r.names).toEqual(['rafaao'])
    expect(r.ignored).toEqual(['Segue a lista aprovada para a campanha deste mês'])
  })

  it('evita duplicados sem diferenciar maiúsculas', () => {
    const r = extractStreamerNames('Rafaao - $200\nrafaao\nRAFAAO - $100\nbob')
    expect(r.names).toEqual(['Rafaao', 'bob'])
    expect(r.duplicates).toBe(2)
  })

  it('linha duvidosa vai para conferência em vez de ser cadastrada', () => {
    const r = extractStreamerNames('Maria Souza\nrafaao - $200')
    expect(r.names).toEqual(['rafaao'])
    expect(r.ambiguous).toEqual([{ line: 'Maria Souza', suggestion: 'Maria' }])
  })

  it('bandeira + palavra que não é país conhecido vai para conferência', () => {
    const r = extractStreamerNames('🇨🇦 Narnia')
    expect(r.names).toEqual([])
    expect(r.ambiguous).toHaveLength(1)
  })

  it('nomes já conhecidos (campanha em edição) são aceitos como estão', () => {
    const r = extractStreamerNames('Fulano de Tal\nrafaao', new Set(['fulano de tal']))
    expect(r.names).toEqual(['Fulano de Tal', 'rafaao'])
    expect(r.ambiguous).toEqual([])
  })

  it('texto vazio não reconhece nada', () => {
    expect(extractStreamerNames('')).toEqual({ names: [], ambiguous: [], ignored: [], duplicates: 0 })
  })
})

describe('toStreamerRows', () => {
  it('monta as linhas da campanha', () => {
    expect(toStreamerRows(['ana'], false)).toEqual([{ streamer_name: 'ana', payment: 0, payment_date: null }])
  })
  it('já confirmados recebem o status confirmado', () => {
    expect(toStreamerRows(['ana'], true)[0].contact_status).toBe('confirmado')
  })
})

describe('mergeNames', () => {
  it('junta listas sem repetir e sem vazios', () => {
    expect(mergeNames(['ana', 'Bob'], ['BOB', ' ', 'caio '])).toEqual(['ana', 'Bob', 'caio'])
  })
})
