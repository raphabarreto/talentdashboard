# Talent Dashboard — instruções do projeto

Stack: Vite + TypeScript (front), Supabase (banco, RLS, Edge Functions), deploy na Vercel.

## Comunicação
- Responder em português brasileiro, de forma simples e objetiva.
- Antes de alterações importantes, explicar brevemente o plano.

## Forma de trabalho (autonomia)
- Trabalhar com autonomia em: investigações, correções locais, testes, build, criação de branches,
  commits, push para branches de trabalho e abertura de Pull Requests.
- Uma correção por vez, seguindo o `AUDIT_STATUS.md`. Ao terminar, atualizar o progresso e seguir para
  a próxima tarefa se não houver bloqueios.
- Ler somente os arquivos relevantes. Evitar dependências novas sem justificativa.
- Não usar subagentes nem fazer auditorias amplas desnecessárias. Economizar tokens.
- Não pedir ao usuário que execute comandos, abra PRs ou consulte ferramentas se for possível fazer isso
  com segurança. Sem acesso, explicar a limitação e pedir só a ação indispensável.
- GitHub CLI (`gh`): usar se disponível para criar PRs e consultar checks. Instalar, autenticar ou
  conceder permissões exige autorização prévia.

## Segurança e produção
- Priorizar segurança, estabilidade e preservação dos dados existentes.
- Exigem autorização explícita do usuário, para cada operação: merge na `main`, deploy, qualquer
  alteração em produção (incluindo dados e configurações do Supabase), mudança de permissões e
  operações destrutivas. Push para `main` também é proibido.
- Merge na `main` com mudanças em `supabase/functions/**` dispara deploy automático das Edge Functions
  (`deploy-functions.yml`): tratar esse merge como publicação em produção.
- Silêncio ou autorização anterior nunca valem como permissão para publicar novas alterações.
- Nunca expor segredos, tokens ou credenciais (nem em logs, diffs ou respostas).
- Em dúvida relevante sobre segurança ou impacto em produção, parar e consultar o usuário.

## Pedido de aprovação
Resumo curto em português simples: o que mudou, testes realizados, riscos e o que exatamente será
publicado. Terminar com: "Autoriza o merge e o deploy automático?"

## Auditoria de segurança
- Ao iniciar, consultar o `AUDIT_STATUS.md`; atualizá-lo ao concluir cada correção ou encerrar a sessão.
- Mantê-lo conciso, sem duplicar informação nem registrar segredos; marcar "a verificar" o que não foi confirmado.

## Testes
- Uma correção só está pronta após `npm run test:run` e `npm run build` (e `tsc --noEmit`), com os
  resultados informados. Verificar também os checks do PR quando possível.
- Não assumir que um teste passou sem executá-lo; se não der para rodar, dizer isso.
