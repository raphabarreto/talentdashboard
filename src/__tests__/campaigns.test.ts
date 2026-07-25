import { describe, it, expect } from 'vitest'

// Mesma lógica usada no parser de valores do formulário de campanhas
// (formato brasileiro: '.' = separador de milhar, ',' = decimal)
function parseBrazilianCurrency(value: string): number {
  const raw = value.replace(/\./g, '').replace(/,/g, '.')
  return Number(raw) || 0
}

// Mesma lógica usada para popular o campo ao editar uma campanha
function formatForInput(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

describe('Campaign currency input round-trip', () => {
  it('deve interpretar corretamente valor digitado no formato BR', () => {
    expect(parseBrazilianCurrency('4.975,03')).toBe(4975.03)
    expect(parseBrazilianCurrency('497,50')).toBe(497.5)
    expect(parseBrazilianCurrency('1.000')).toBe(1000)
  })

  it('deve formatar valor numérico de volta para o input sem explodir', () => {
    expect(formatForInput(4975.03)).toBe('4975,03')
    expect(formatForInput(497.5)).toBe('497,50')
  })

  it('round-trip: salvar e reabrir para editar não deve alterar o valor', () => {
    const original = 4975.03
    const displayed = formatForInput(original)
    const parsedBack = parseBrazilianCurrency(displayed)
    expect(parsedBack).toBe(original)
  })

  it('regressão: valor vindo em formato US (ponto decimal) não deve ser tratado como milhar', () => {
    // Isso reproduz o bug: se o campo fosse populado com String(4975.03) = "4975.03"
    // e depois salvo pelo parser BR, o resultado errado seria 497503.
    const buggyInput = String(4975.03) // "4975.03"
    const wronglyParsed = parseBrazilianCurrency(buggyInput)
    expect(wronglyParsed).toBe(497503) // comportamento do bug, documentado

    // A correção usa formatForInput, que gera o formato correto:
    const fixedInput = formatForInput(4975.03) // "4975,03"
    expect(parseBrazilianCurrency(fixedInput)).toBe(4975.03)
  })
})
