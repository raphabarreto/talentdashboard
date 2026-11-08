#!/usr/bin/env bash
# Sobe um Postgres DESCARTÁVEL da imagem oficial do Supabase, aplica as migrations REAIS do serviço de autenticação
# (GoTrue: cria auth.jwt(), auth.uid()...) e espera o servidor definitivo ficar pronto.
# A imagem inicia um servidor temporário para suas migrations internas e depois reinicia; um "service container"
# comum acha que já está saudável durante essa fase. Uso: scripts/backup/start-postgres.sh
set -euo pipefail
IMAGE="supabase/postgres:17.6.1.178"
AUTH_IMAGE="supabase/gotrue:v2.197.0"
export PGPASSWORD=postgres

docker rm -f bk-pg >/dev/null 2>&1 || true
docker run -d --name bk-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 "$IMAGE" >/dev/null

for i in $(seq 1 90); do
  if docker logs bk-pg 2>&1 | grep -q "init process complete"; then break; fi
  if [ "$i" = 90 ]; then
    echo "::error::inicializacao do Postgres do Supabase nao terminou"
    docker logs bk-pg 2>&1 | grep -E "ERROR|FATAL" | head -5
    exit 1
  fi
  sleep 2
done

READY=0
for i in $(seq 1 60); do
  if psql -X -h localhost -U postgres -Atqc "select 1" 2>/dev/null | grep -q 1; then READY=1; break; fi
  sleep 2
done
if [ "$READY" != 1 ]; then echo "::error::Postgres do Supabase nao aceitou conexoes"; exit 1; fi

# auth.jwt()/auth.uid()/auth.role() sao criadas pelo servico de autenticacao, nao pela imagem do Postgres.
# Aplicamos as migrations dele (o servico em si nao fica rodando).
# Banco descartável: garante a senha do papel que o serviço de autenticação usa.
psql -X -h localhost -U supabase_admin -Atqc "alter role supabase_auth_admin with password 'postgres'" >/dev/null 2>&1 \
  || psql -X -h localhost -U postgres -Atqc "alter role supabase_auth_admin with password 'postgres'" >/dev/null
LOG="$(mktemp)"
if ! docker run --rm --network host \
  -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_NAMESPACE=auth \
  -e GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:postgres@localhost:5432/postgres" \
  -e GOTRUE_JWT_SECRET=ci-only-nao-e-segredo-ci-only-nao-e-segredo \
  -e GOTRUE_SITE_URL=http://localhost -e API_EXTERNAL_URL=http://localhost:9999 \
  "$AUTH_IMAGE" auth migrate >"$LOG" 2>&1; then
  echo "::error::migrations do servico de autenticacao falharam"
  grep -iE "error|fatal|unknown|not found" "$LOG" | head -5
  exit 1
fi
if ! psql -X -h localhost -U postgres -Atqc "select to_regprocedure('auth.jwt()') is not null" | grep -q t; then
  echo "::error::auth.jwt() nao existe apos as migrations do auth"
  exit 1
fi
echo "Postgres do Supabase pronto (com migrations do auth)"
