# Talent Dashboard — instruções do projeto

Stack: Vite + TypeScript (front), Supabase (banco, RLS, Edge Functions), deploy na Vercel.

## Comunicação
- Responder em português brasileiro, de forma simples e objetiva. O usuário não é programador:
  resumos curtos do que mudou e do que importa, sem listar comandos técnicos.
- Interromper o usuário só quando a intervenção dele for realmente necessária.

## Forma de trabalho (autonomia)
- Assumir manutenção e auditoria com autonomia: investigar, corrigir, testar, criar branches, commits,
  push de branches de trabalho, abrir PRs, revisar checks e corrigir falhas por conta própria antes de
  chamar o usuário.
- Uma correção por vez, seguindo o `AUDIT_STATUS.md`. Ao concluir, atualizar o progresso e seguir
  para o próximo item sem esperar instrução.
- Não misturar mudanças de alto risco com correções de rotina (PRs separados).
- Ler somente os arquivos relevantes. Evitar dependências novas sem justificativa.
- Não usar subagentes nem fazer auditorias amplas desnecessárias. Economizar tokens.
- Não pedir ao usuário que execute comandos ou abra PRs se for possível fazer com segurança.
- `gh` e Supabase CLI: usar se já estiverem autenticados. Instalar, autenticar ou conceder novas
  permissões exige autorização prévia.

## Publicação autônoma (baixo risco)
Pode fazer merge na `main` (sempre via PR, nunca push direto) e deixar o deploy automático acontecer
quando TODAS as condições valerem:
1. `npm run test:run`, `tsc --noEmit` e `npm run build` verdes localmente, e checks do PR verdes.
2. Existe reversão clara e rápida (revert do PR, rollback documentado) e ela está descrita no PR.
3. A mudança não toca nenhuma das áreas de alto risco abaixo e não há risco relevante de derrubar o
   dashboard.
4. Depois do merge: confirmar que o deploy terminou (GitHub Actions / Vercel) e, quando possível,
   verificar o efeito (ex.: cabeçalhos via `curl`). Se algo falhar, reverter e avisar o usuário.
- Nunca publicar com testes falhando. Nunca fazer mudanças destrutivas ou irreversíveis.
- Se a correção depender de teste manual que não é possível fazer, publicar só se o risco for baixo e
  registrar a funcionalidade como "a verificar" no `AUDIT_STATUS.md` (nunca como validada).
- Merge na `main` com mudanças em `supabase/functions/**` dispara deploy automático das Edge
  Functions (`deploy-functions.yml`): isso é publicação em produção e segue as mesmas condições.

## Alto risco: exige autorização explícita do usuário, a cada operação
- Dados, permissões, autenticação, RLS, funções de segurança, segredos ou estrutura do banco de produção.
- Qualquer SQL em produção: nunca executar migrações automaticamente. Fluxo: confirmar o projeto
  correto, ler o estado atual, preparar rollback, explicar em português simples, aguardar o "autorizo",
  executar só aquele SQL, validar e avisar. Usar `--yes` do Supabase CLI apenas após essa autorização.
- Mudanças que possam interromper o dashboard de forma relevante.
- Operações destrutivas ou irreversíveis, e `push --force`.
- Nunca expor segredos, tokens ou credenciais (nem em logs, diffs ou respostas).
- Em dúvida relevante sobre segurança ou impacto em produção, parar e consultar o usuário.
- Autorização é por operação: silêncio ou autorização anterior não valem para alterações novas.

## Pedido de autorização (só para alto risco)
Resumo curto em português simples: o que mudará, testes feitos, riscos, rollback e o que exatamente
será executado/publicado. Terminar com uma pergunta objetiva (ex.: "Autoriza executar o SQL?").

## Auditoria de segurança
- Ao iniciar, consultar o `AUDIT_STATUS.md`; atualizá-lo ao concluir cada correção ou encerrar a sessão.
- Mantê-lo conciso, sem duplicar informação nem registrar segredos; marcar "a verificar" o que não foi confirmado.

## Testes
- Uma correção só está pronta após `npm run test:run`, `tsc --noEmit` e `npm run build`, com os
  resultados informados. Verificar também os checks do PR.
- Não assumir que um teste passou sem executá-lo; se não der para rodar, dizer isso.
