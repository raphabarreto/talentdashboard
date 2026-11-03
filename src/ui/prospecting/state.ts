import type { ProspectStream } from './types'

// Estado da tela de Prospecção (resultado da busca, seleção, página e categoria escolhida).
export const ps = {
  results: [] as ProspectStream[],
  selected: new Set<string>(),
  page: 1,
  gameId: '',
}
