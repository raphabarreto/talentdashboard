import type { ProspectStream } from './types'

// Estado da tela de Prospecção (resultado da busca, seleção, página e categoria escolhida).
export const ps = {
  results: [] as ProspectStream[],
  selected: new Set<string>(),
  shortlistSelected: new Set<string>(), // marcados na Minha Lista (só em memória)
  page: 1,
  gameId: '',
}
