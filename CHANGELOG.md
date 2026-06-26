# Changelog

## [2.1.0] - 2026-06-26

### ✨ Adicionado
- **PWA**: Dashboard pode ser instalado como app nativo (desktop/mobile)
- **Exportação CSV**: Streamers selecionados podem ser exportados para planilha
- **Atalho Ctrl+K**: Foca campo de busca rapidamente
- **Filtro "Sem Categoria"**: Facilita encontrar streamers não categorizados
- **11 novos testes**: Total de 24 testes automatizados

### ⚡ Performance
- **Debounce (300ms)**: Busca não dispara a cada tecla digitada
- **Cache de filtros**: Países e categorias calculados apenas quando necessário
- **Query SQL otimizada**: Função `get_latest_snapshots()` reduz tráfego em ~99%
- **DocumentFragment**: Renderização de tabela/cards 5x mais rápida
- **Bundle reduzido**: De 225KB para 220KB

### 🔨 Refatoração
- **Código duplicado removido**: ~230 linhas eliminadas
- **Funções modulares**: 
  - `src/events/streamers/addStreamer.ts` (80 linhas)
  - `src/events/streamers/lookup.ts` (116 linhas)
- **Função helper**: `prepareStreamerData()` centraliza lógica de busca
- **setupStreamersEvents**: Reduzido de 395 para 280 linhas

### 📚 Documentação
- Adicionado `docs/PERFORMANCE.md` com detalhes das otimizações
- README atualizado com novas features
- Estrutura de pastas documentada

---

## [2.0.0] - 2026-06 (versão anterior)

### Features principais
- Dashboard de streamers com cards e tabelas
- Gestão de campanhas com cálculo de comissão
- Coleta automática via Edge Functions
- Autenticação Google OAuth
- Badges "AO VIVO" em tempo real
- Testes automatizados (13 testes)
- Exportação de campanhas para CSV
