# Changelog

## [2.2.0] - 2026-11-03

### 🔒 Segurança
- RLS por allowlist de e-mail (`is_allowed_user()`), `twitch-proxy` exige usuário permitido
- Funções de cron falham fechado sem `CRON_SECRET`; falhas da Twitch não gravam snapshots falsos
- Proteção contra XSS (`escapeHtml`), cabeçalhos de segurança e CSP bloqueante (Vercel)
- Usuário fora da lista é deslogado (antes entrava em loop entre login e home)

### ✨ Adicionado
- Prospecção: lista salva no banco (tabela `prospect_shortlist`) e cache de categorias
- Cadastro de streamer em módulo único (`registration.ts`), com avisos de erro

### 🛠 Manutenção
- Zod 4 nas Edge Functions, `supabase-js` fixado, Node 22 no CI
- Favicon e manifest servidos de `public/`; menus dos cards fecham ao abrir outro

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
