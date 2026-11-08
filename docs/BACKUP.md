# Backup automático do Supabase (GitHub Actions)

**Estado: implementado, mas desligado.** O workflow `Backup Supabase` só roda manualmente. Não há agendamento ativo, chave, token nem secret configurados (isso depende de autorização do dono do projeto).

## O que faz
1. Uma consulta SQL **somente leitura** (API de gerenciamento do Supabase, token restrito a este projeto e à permissão `database_read`) devolve as 6 tabelas essenciais em um único JSON: `allowed_users`, `streamers`, `campaigns`, `campaign_streamers`, `prospect_shortlist`, `streamer_history`. Todas as colunas e IDs originais, sem alterar nada.
2. Valida estrutura, contagens, chaves primárias e relacionamentos.
3. **Testa a restauração** num Postgres descartável com as dependências reais do Supabase (ver abaixo).
4. Criptografa com a **chave pública** GPG e gera um manifesto (só contagens, hash e destinatário).
5. Publica o artifact `backup-AAAA-MM-DD` (fuso de Brasília) com retenção de **30 dias**.
6. Confirma que o GitHub guardou o artifact (existe, não expirou, tamanho > 0, hash igual ao enviado).

Custo: R$ 0 (repositório público tem Actions gratuito; sem cartão). Nada roda no computador do dono.

## Agendamento (quando autorizado)
Duas verificações por dia, 06h e 18h de Brasília (`0 9 * * *` e `0 21 * * *`, em UTC), gerando **um** backup por dia: se já existir um backup válido do dia, o workflow encerra sem criar outro. "Válido" **não** é só o nome do artifact; é preciso: execução concluída com sucesso, ramo `main`, arquivo `.gpg` com o mesmo hash e tamanho do manifesto, e criptografado para a chave pública configurada. Se a verificação não puder ser feita, cria-se um backup novo (um a mais é inofensivo).

## Teste de restauração (o que cobre)
Roda dentro do workflow, a cada backup, num contêiner descartável `supabase/postgres` (papéis `anon`/`authenticated`/`service_role`, esquema `auth`) ao qual são aplicadas as **migrations reais do serviço de autenticação** (`supabase/gotrue`, que cria `auth.jwt()`), via `scripts/backup/start-postgres.sh`: aplica `schema.sql` + `calculate_streamer_metrics.sql`, restaura os dados na ordem das chaves estrangeiras, exporta de volta e compara com o backup (valores, linhas, colunas; ignora só diferenças de fuso/formatação numérica). Depois confere as políticas RLS de verdade: usuário da lista vê todos os streamers e executa `get_streamers_with_live_status()`; usuário fora da lista não vê nada. Nunca toca em produção.
**O que NÃO cobre:** papéis/permissões idênticos aos de produção, extensões, Storage, `auth.users`, versão exata do Postgres de produção (imagens fixadas em `supabase/postgres:17.6.1.178` e `supabase/gotrue:v2.197.0`; atualizar de tempos em tempos). Uma restauração real em um projeto novo continua sendo um procedimento manual.

## Verificações sem falso alarme
A consulta é uma única instrução SQL: dados e contagens saem do **mesmo retrato** do banco. Mudanças legítimas durante a execução não geram divergência. Não há comparação com o backup anterior nem segunda consulta. Só falham: tabela ausente, `allowed_users`/`streamers` vazias, contagem incoerente dentro do próprio retrato, chave repetida ou referência órfã.

## Logs públicos (o repositório é público)
Nenhum script imprime dados: só nomes de tabelas, contagens, códigos SQLSTATE e hashes. Erros do `psql` são filtrados para mostrar apenas o código. O JSON em texto puro existe só no disco temporário do runner e nunca entra no artifact (o script recusa pastas com outros arquivos). O artifact contém apenas o `.gpg` e o manifesto. Qualquer usuário logado no GitHub consegue baixar artifacts de repositório público; sem a chave privada o arquivo é ilegível.

## Limitações conhecidas
- **Desativação por inatividade:** em repositório público, o GitHub desativa agendamentos após 60 dias sem atividade no repositório. Por decisão do projeto, o workflow **não** faz commits artificiais nem recebe permissão de escrita para evitar isso. Se o repositório ficar 60 dias parado, os backups pararão **sem aviso**. Conferir a lista de backups pelo menos uma vez por mês (ou reativar o workflow na aba Actions) e manter o projeto com alguma atividade.
- **Ponto único de falha:** os artifacts ficam no GitHub. Se o repositório ou a conta forem perdidos, os backups vão junto. Mitigação gratuita: baixar o `.gpg` mais recente uma vez por mês para o computador/pendrive.
- **Chave privada:** única forma de recuperar os dados; guardar em dois lugares fora do GitHub. Perdê-la inutiliza todos os backups.
- O endpoint de consulta do Supabase é marcado como beta; se mudar, o workflow falha e o GitHub avisa por e-mail (padrão de falha de workflow).
- Um backup só vale depois de um teste de recuperação com a chave privada (ver abaixo).

## O que fica fora do backup
Credenciais e secrets (Supabase, Edge Functions, Vercel, Twitch), usuários do login (`auth.users`) e a configuração do Google, `stream_snapshots` (temporários e regeneráveis), cron externo (cron-job.org), variáveis da Vercel. A estrutura vem do `schema.sql` e de `supabase/migrations/`.

## Recuperação (manual)
1. Baixar o artifact `backup-AAAA-MM-DD` (aba Actions → execução → Artifacts, ou `gh run download`).
2. Descriptografar com a chave privada: `gpg -d backup-AAAA-MM-DD.json.gpg > backup.json`.
3. Num projeto Supabase **novo**: aplicar `schema.sql` e `supabase/migrations/calculate_streamer_metrics.sql`; depois rodar `scripts/backup/restore.sql` com `BACKUP_JSON=backup.json` (ordem das tabelas já correta). Conferir contagens com `node scripts/backup/compare.mjs`. Reconfigurar secrets, login Google e cron.
Em produção, qualquer restauração exige autorização explícita (CLAUDE.md).

## Para ativar (quando o dono autorizar)
1. Gerar o par de chaves GPG no computador; guardar a privada fora do GitHub.
2. Criar no Supabase um token pessoal restrito a este projeto, permissão `database_read`.
3. Cadastrar: secret `SUPABASE_BACKUP_TOKEN`; variáveis `BACKUP_GPG_PUBLIC_KEY` (chave pública ASCII) e `SUPABASE_PROJECT_REF`.
4. Rodar o workflow manualmente uma vez, conferir, e só então descomentar o bloco `schedule`.

## Auto-teste no CI
`Backup auto-teste` roda em PRs que mexem nesses arquivos, com dados fictícios e chave descartável (sem secrets): valida, restaura no Postgres do Supabase, criptografa, envia um artifact de 1 dia, verifica o upload, exercita a checagem "já existe backup" e recupera com a chave privada.

## Reversão
Remover `.github/workflows/backup.yml`, `backup-selftest.yml` e `scripts/backup/` (revert do PR). Nenhum dado, workflow existente ou configuração do Vercel/Supabase é alterado.
