#!/usr/bin/env bash
# Sobe um Postgres DESCARTÁVEL da imagem oficial do Supabase, aplica as migrations REAIS do serviço de autenticação
# (GoTrue: cria auth.jwt(), auth.uid()...) e espera o servidor definitivo ficar pronto.
# A imagem inicia um servidor temporário para suas migrations internas e depois reinicia; um "service container"
# comum acha que já está saudável durante essa fase.
#
# Segurança (também fora do GitHub Actions): a porta é publicada SÓ em 127.0.0.1 (a senha é de teste e fraca);
# o contêiner tem rótulo próprio e só contêineres com esse rótulo são removidos; nada fora dele é tocado.
# Uso: scripts/backup/start-postgres.sh   (porta: BK_PG_PORT, padrão 54329)   |   limpeza: scripts/backup/stop-postgres.sh
set -euo pipefail
IMAGE="supabase/postgres:17.6.1.178"
AUTH_IMAGE="supabase/gotrue:v2.197.0"
NAME="bk-restore-test"
LABEL="talentdashboard.backup-test=1"
PORT="${BK_PG_PORT:-54329}"
export PGPASSWORD=postgres PGHOST=127.0.0.1 PGPORT="$PORT"

if docker ps -a --filter "name=^${NAME}\$" --format '{{.Names}}' | grep -q .; then
  if docker ps -a --filter "name=^${NAME}\$" --filter "label=${LABEL}" --format '{{.Names}}' | grep -q .; then
    docker rm -f "$NAME" >/dev/null
  else
    echo "::error::ja existe um contêiner '${NAME}' que NAO e deste teste; nada foi removido"; exit 1
  fi
fi
docker run -d --name "$NAME" --label "$LABEL" -e POSTGRES_PASSWORD=postgres -p "127.0.0.1:${PORT}:5432" "$IMAGE" >/dev/null

for i in $(seq 1 90); do
  if docker logs "$NAME" 2>&1 | grep -q "init process complete"; then break; fi
  if [ "$i" = 90 ]; then
    echo "::error::inicializacao do Postgres do Supabase nao terminou"
    docker logs "$NAME" 2>&1 | grep -E "ERROR|FATAL" | head -5
    exit 1
  fi
  sleep 2
done

READY=0
for i in $(seq 1 60); do
  if psql -X -U postgres -Atqc "select 1" 2>/dev/null | grep -q 1; then READY=1; break; fi
  sleep 2
done
if [ "$READY" != 1 ]; then echo "::error::Postgres do Supabase nao aceitou conexoes"; exit 1; fi

# auth.jwt()/auth.uid()/auth.role() sao criadas pelo servico de autenticacao, nao pela imagem do Postgres.
# Aplicamos as migrations dele (o servico em si nao fica rodando). Banco descartavel: define a senha do papel que ele usa.
docker exec "$NAME" psql -X -U supabase_admin -d postgres -Atqc "alter role supabase_auth_admin with password 'postgres'" >/dev/null
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT
if ! docker run --rm --network host \
  -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_NAMESPACE=auth \
  -e GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:postgres@127.0.0.1:${PORT}/postgres" \
  -e GOTRUE_JWT_SECRET=ci-only-nao-e-segredo-ci-only-nao-e-segredo \
  -e GOTRUE_SITE_URL=http://localhost -e API_EXTERNAL_URL=http://localhost:9999 \
  "$AUTH_IMAGE" auth migrate >"$LOG" 2>&1; then
  echo "::error::migrations do servico de autenticacao falharam"
  grep -iE "error|fatal|unknown|not found" "$LOG" | head -5
  exit 1
fi
if ! psql -X -U postgres -Atqc "select to_regprocedure('auth.jwt()') is not null" | grep -q t; then
  echo "::error::auth.jwt() nao existe apos as migrations do auth"
  exit 1
fi
echo "Postgres do Supabase pronto em 127.0.0.1:${PORT} (com migrations do auth)"
