# Talent Dashboard — instruções do projeto

Stack: Vite + TypeScript (front), Supabase (banco, RLS, Edge Functions), deploy na Vercel.

## Comunicação
- Responder em português brasileiro, de forma simples e objetiva.
- Antes de alterações importantes, explicar brevemente o plano.

## Forma de trabalho
- Uma tarefa por vez; evitar análises desnecessárias.
- Ler somente os arquivos relevantes para a tarefa.
- Não criar subagentes nem iniciar auditorias completas sem necessidade.
- Evitar dependências novas sem justificativa.

## Segurança e produção
- Priorizar segurança, estabilidade e preservação dos dados existentes.
- Nunca executar deploy, merge ou push sem autorização explícita.
- Nunca alterar dados ou configurações do Supabase de produção sem autorização explícita.
- Nunca expor segredos, tokens ou credenciais (nem em logs, diffs ou respostas).

## Auditoria de segurança
- Ao iniciar, consultar o `AUDIT_STATUS.md`; atualizá-lo ao concluir cada correção ou encerrar a sessão.
- Mantê-lo conciso, sem duplicar informação nem registrar segredos; marcar "a verificar" o que não foi confirmado.

## Testes
- Após alterações, executar os testes relevantes quando possível (`npm run test:run`, `npm run build`) e informar os resultados.
- Não assumir que um teste passou sem executá-lo; se não der para rodar, dizer isso.
