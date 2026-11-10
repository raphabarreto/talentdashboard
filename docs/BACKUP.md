# Backup automático do Supabase (GitHub Actions)

**Estado: implementado; os backups vão para Releases do repositório PRIVADO `talentdashboard-backups`. O agendamento está DESLIGADO** (só execução manual até validar um backup real e sua recuperação).

## O que faz
1. Uma consulta SQL **somente leitura** (API de gerenciamento do Supabase, token restrito a este projeto e à permissão `database_read`) devolve as 6 tabelas essenciais em um único JSON: `allowed_users`, `streamers`, `campaigns`, `campaign_streamers`, `prospect_shortlist`, `streamer_history`. Todas as colunas e IDs originais, sem alterar nada.
2. Valida estrutura, contagens, chaves primárias e relacionamentos.
3. **Testa a restauração** num Postgres descartável com as dependências reais do Supabase (ver abaixo).
4. Criptografa com a **chave pública** GPG e gera um manifesto (só contagens, hash e destinatário).
5. **Publica na Release privada** `backup-AAAA-MM-DD` (fuso de Brasília) do repositório `talentdashboard-backups`, com `scripts/backup/publish-release.mjs`: confere o arquivo local, confere que o repositório é privado e que o token escreve nele, cria um **rascunho**, envia o `.json.gpg` e o `manifest.json`, baixa de volta e compara hash e tamanho, e só então publica. Releases publicadas são imutáveis. Se algo falhar antes de publicar, o rascunho é apagado e o job falha (nova tentativa é segura). Rascunhos antigos só são apagados se forem comprovadamente nossos (tag do dia, corpo idêntico ao nosso e só os 2 arquivos do backup); qualquer outro é deixado como está. Depois de publicar, `immutable === true` precisa estar confirmado na resposta da API; valor ausente não é aceito (nem na publicação, nem na checagem de backups existentes).
6. Nenhum artifact é publicado no repositório público. Sem retenção automática nesta etapa (cada backup tem ~21 KB).

Custo: R$ 0 (Actions gratuito no repositório público; Releases no repositório privado). Nada roda no computador do dono.

## Agendamento (quando autorizado)
Duas verificações por dia, 06h e 18h de Brasília (`0 9 * * *` e `0 21 * * *`, em UTC), gerando **um** backup por dia: se já existir um backup válido do dia, o workflow encerra sem criar outro. "Válido" **não** é só o nome da Release; é preciso: Release **publicada** (rascunho de tentativa que falhou não conta) com a tag `backup-AAAA-MM-DD`, não marcada como mutável, arquivo `.gpg` com o mesmo hash e tamanho do manifesto, e criptografado para a chave pública configurada. A chave pública é pública: qualquer pessoa consegue gerar um `.gpg` "válido" para ela; por isso a origem vem do lugar: repositório privado, escrito só pelo token restrito, em Release imutável. Se a verificação não puder ser feita, cria-se um backup novo (um a mais é inofensivo). Se a tag do dia já estiver publicada e o backup for forçado (`force`), a nova Release usa o sufixo `-r<número da execução>`. **Limite:** sem a chave privada não dá para abrir o conteúdo; a checagem prova origem e integridade do arquivo, não o conteúdo (por isso o conteúdo é validado ANTES de criptografar e o teste mensal com a chave privada continua necessário).

## Teste de restauração (o que cobre)
Roda dentro do workflow, a cada backup, num contêiner descartável `supabase/postgres` (papéis `anon`/`authenticated`/`service_role`, esquema `auth`) ao qual são aplicadas as **migrations reais do serviço de autenticação** (`supabase/gotrue`, que cria `auth.jwt()`), via `scripts/backup/start-postgres.sh`: aplica `schema.sql` + `calculate_streamer_metrics.sql`, restaura os dados na ordem das chaves estrangeiras, exporta de volta e compara com o backup (valores, linhas, colunas; ignora só diferenças de fuso/formatação numérica). Depois confere as políticas RLS de verdade: usuário da lista vê todos os streamers e executa `get_streamers_with_live_status()`; usuário fora da lista não vê nada. Nunca toca em produção.
**O que NÃO cobre:** papéis/permissões idênticos aos de produção, extensões, Storage, `auth.users`, versão exata do Postgres de produção (imagens fixadas em `supabase/postgres:17.6.1.178` e `supabase/gotrue:v2.197.0`; atualizar de tempos em tempos). Uma restauração real em um projeto novo continua sendo um procedimento manual.

## Fidelidade dos dados
O texto do backup é o `jsonb::text` devolvido pelo banco e é gravado **sem reserializar** (números `numeric` não passam por `double` do JavaScript). Os tipos reais das 6 tabelas foram conferidos (somente metadados, 08/11/2026) e batem com `schema.sql` e com as colunas exigidas pelo validador. Cadeia sem perda: API (`jsonb::text`) → arquivo (texto exato) → criptografia (bytes do arquivo) → restauração (`jsonb` → `numeric`, exato) → exportação (`jsonb::text`) → comparação. A comparação (`compare.mjs`) é **exata**: lê os dois arquivos com `parseLossless` (usa o texto original de cada número; exige Node >= 22), compara os números por valor decimal com todos os dígitos (`150.50` = `150.5` = `1.505e2`, mas `…012` ≠ `…013`) e as colunas `timestamptz` conhecidas por instante em UTC com microssegundos, aceitando qualquer fuso (`Z`, `+HH`, `+HH:MM`, `+HHMM`, `+HH:MM:SS`). Textos que só parecem horário (ex.: dentro de `jsonb`) são comparados literalmente. Os testes unitários e o auto-teste do CI exercitam diferenças só no último dígito de valores financeiros e de 1 microssegundo/1 minuto de fuso (falham quando há alteração real e passam quando é o mesmo valor/instante).

## Verificações sem falso alarme
A consulta é uma única instrução SQL: dados e contagens saem do **mesmo retrato** do banco. Mudanças legítimas durante a execução não geram divergência. Não há comparação com o backup anterior nem segunda consulta. Só falham: tabela ausente, `allowed_users`/`streamers` vazias, contagem incoerente dentro do próprio retrato, chave repetida ou referência órfã.

## Logs públicos (o repositório é público)
Nenhum script imprime dados: só nomes de tabelas, contagens, códigos SQLSTATE e hashes. Erros do `psql` são filtrados para mostrar apenas o código. O JSON em texto puro existe só no disco temporário do runner e nunca é enviado (o script recusa pastas com outros arquivos). A Release contém apenas o `.gpg` e o manifesto, em repositório privado. O token do repositório de backups é mascarado e nunca impresso; erros mostram só o código HTTP.

## Segurança do workflow
- Permissões mínimas do `GITHUB_TOKEN` (`contents: read`); Actions fixadas por hash de commit; o token do Supabase só existe na etapa de coleta e o `BACKUPS_REPO_TOKEN` só nas etapas que falam com o repositório de backups (checagem e publicação).
- Os jobs `check` e `backup` usam o **ambiente** `backup`: os tokens (`SUPABASE_BACKUP_TOKEN` e `BACKUPS_REPO_TOKEN`) ficam como secrets do ambiente, com regra de implantação só para `main`, então uma execução em outro ramo (ou alteração de scripts em PR) não recebe os tokens. O `BACKUPS_REPO_TOKEN` é fine-grained, restrito ao repositório `talentdashboard-backups`, com `Contents: Read and write`.
- O auto-teste (`pull_request`) não usa secrets nem tokens; PRs de fork rodam sem segredos. A publicação e a checagem das Releases são testadas com uma API simulada (`src/__tests__/backup-release.test.ts`), que também falha se um workflow de backup voltar a usar `upload-artifact`.
- Todo script importa `safe.mjs`: exceções inesperadas viram mensagem genérica (o Node inclui trechos do conteúdo em erros de `JSON.parse`).
- `restore-test.sh` recusa rodar se o banco não for local (`127.0.0.1`/`localhost`) e vazio; `start-postgres.sh` publica a porta só em `127.0.0.1`, só remove contêiner com o rótulo do teste e é desfeito por `stop-postgres.sh` (`if: always()`).

## Limitações conhecidas
- **Desativação por inatividade:** em repositório público, o GitHub desativa agendamentos após 60 dias sem atividade no repositório. Por decisão do projeto, o workflow **não** faz commits artificiais nem recebe permissão de escrita para evitar isso. Se o repositório ficar 60 dias parado, os backups pararão **sem aviso**. Conferir a lista de backups pelo menos uma vez por mês (ou reativar o workflow na aba Actions) e manter o projeto com alguma atividade.
- **Ponto único de falha:** as Releases ficam no GitHub. Se a conta for perdida, os backups vão junto. Mitigação gratuita: baixar o `.gpg` mais recente uma vez por mês para o computador/pendrive.
- **Chave privada:** única forma de recuperar os dados; guardar em dois lugares fora do GitHub. Perdê-la inutiliza todos os backups.
- **Token:** o Supabase permite token pessoal escopado a UM projeto com permissões por recurso. Usar permissões personalizadas (só "Database: read"); NÃO usar a predefinição "Read-only", que inclui segredos como chaves de API. O mapeamento exato do endpoint `read-only` para essa permissão vem da documentação e só será confirmado na Etapa 2 (uma consulta de teste; um 403 indica permissão errada). O token não pode ser alterado depois de criado e expira conforme configurado: anotar a data.
- Atrasos: execuções agendadas do GitHub podem atrasar ou ser puladas em horários de pico; por isso são duas por dia. O e-mail de falha vai para quem editou o cron por último.
- O endpoint de consulta do Supabase é marcado como beta; se mudar, o workflow falha e o GitHub avisa por e-mail (padrão de falha de workflow).
- Um backup só vale depois de um teste de recuperação com a chave privada (ver abaixo).

## O que fica fora do backup
Credenciais e secrets (Supabase, Edge Functions, Vercel, Twitch), usuários do login (`auth.users`) e a configuração do Google, `stream_snapshots` (temporários e regeneráveis), cron externo (cron-job.org), variáveis da Vercel. A estrutura vem do `schema.sql` e de `supabase/migrations/`.

## Recuperação (manual)
1. Baixar a Release `backup-AAAA-MM-DD` do repositório privado `talentdashboard-backups` (com a sua conta logada: `gh release download backup-AAAA-MM-DD -R <dono>/talentdashboard-backups`, ou pelo site, na página Releases).
2. Importar a chave privada (`gpg --import`) e descriptografar: `gpg -d backup-AAAA-MM-DD.json.gpg > backup.json`.
3. Num projeto Supabase **novo**: aplicar `schema.sql` e `supabase/migrations/calculate_streamer_metrics.sql`; depois rodar `scripts/backup/restore.sql` com `BACKUP_JSON=backup.json` (ordem das tabelas já correta). Conferir contagens com `node scripts/backup/compare.mjs`. Reconfigurar secrets, login Google e cron.
Em produção, qualquer restauração exige autorização explícita (CLAUDE.md).

## Para ativar (quando o dono autorizar)
1. Gerar o par de chaves GPG no computador; guardar a privada fora do GitHub.
2. Criar no Supabase um token pessoal escopado a este projeto, com permissões personalizadas: somente Database read. Criar também o repositório privado `talentdashboard-backups` (Actions desabilitado, Releases imutáveis ativadas) e um token fine-grained só nele (`Contents: Read and write`), cadastrado como `BACKUPS_REPO_TOKEN` no ambiente `backup`.
3. **Ordem obrigatória (o ambiente vem antes de qualquer secret):** (a) no GitHub, Settings → Environments → criar `backup` com "Deployment branches and tags" = *Selected branches* → somente `main`; (b) rodar `bash scripts/backup/check-environment.sh` e só continuar se imprimir `OK` (ele falha se o ambiente não existir, se aceitar outro ramo, ou se já houver secret `SUPABASE_BACKUP_TOKEN` no repositório/organização, o que ignoraria a restrição); (c) só então cadastrar `SUPABASE_BACKUP_TOKEN` **no ambiente**. Se o workflow rodar antes do ambiente existir, o GitHub o cria sem restrição: por isso nenhum secret pode existir antes do passo (b). Além disso, o job `backup` aborta se não estiver rodando a partir de `refs/heads/main`. Em Settings → Variables (repositório): `BACKUP_GPG_PUBLIC_KEY` (UMA chave pública ASCII, sem expiração curta) e `SUPABASE_PROJECT_REF`.
4. Rodar o workflow manualmente uma vez, conferir, e só então descomentar o bloco `schedule`.

## Auto-teste no CI
`Backup auto-teste` roda em PRs que mexem nesses arquivos, com dados fictícios e chave descartável (sem secrets): valida, restaura no Postgres do Supabase, criptografa e recupera com a chave privada.

## Reversão
Remover `.github/workflows/backup.yml`, `backup-selftest.yml` e `scripts/backup/` (revert do PR). Nenhum dado, workflow existente ou configuração do Vercel/Supabase é alterado.
