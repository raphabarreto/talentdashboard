#!/usr/bin/env bash
# Sobe um Postgres DESCARTÁVEL da imagem oficial do Supabase e espera o servidor DEFINITIVO ficar pronto.
# (A imagem inicia um servidor temporário para rodar as migrations internas e depois reinicia; um "service container"
# comum acha que já está saudável durante essa fase.) Uso: scripts/backup/start-postgres.sh
set -euo pipefail
IMAGE="supabase/postgres:17.6.1.178"
AUTH_IMAGE="supabase/gotrue:v2.197.0"
docker rm -f bk-pg >/dev/null 2>&1 || true
docker run -d --name bk-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 "$IMAGE" >/dev/null
for i in $(seq 1 90); do
  if docker logs bk-pg 2>&1 | grep -q "init process complete"; then break; fi
  [ "$i" = 90 ] && { echo "::error::inicializacao do Postgres do Supabase nao terminou"; docker logs bk-pg 2>&1 | grep -E "ERROR|FATAL" | head -5; exit 1; }
  sleep 2
done
for i in $(seq 1 60); do
  if PGPASSWORD=postgres psql -X -h localhost -U postgres -Atqc "select 1" 2>/dev/null | grep -q 1; then READY=1; break; fi
  sleep 2
done
[ "${READY:-0}" = 1 ] || { echo "::error::Postgres do Supabase nao aceitou conexoes"; exit 1; }

# Funcoes auth.jwt()/auth.uid()/auth.role() sao criadas pelo servico de autenticacao (GoTrue), nao pela imagem do Postgres:
# aplicamos as migrations REAIS dele (so as migrations, o servico nao fica rodando).
if ! docker run --rm --network host -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_NAMESPACE=auth \n  -e GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:postgres@localhost:5432/postgres" \n  -e GOTRUE_JWT_SECRET=ci-only-nao-e-segredo-ci-only-nao-e-segredo -e GOTRUE_SITE_URL=http://localhost -e API_EXTERNAL_URL=http://localhost:9999 \n  "$AUTH_IMAGE" auth migrate > /tmp/auth-migrate.log 2>&1; then
  echo "::error::migrations do servico de autenticacao falharam"; grep -iE "error|fatal" /tmp/auth-migrate.log | head -5; exit 1
fi
PGPASSWORD=postgres psql -X -h localhost -U postgres -Atqc "select to_regprocedure('auth.jwt()') is not null" | grep -q t || { echo "::error::auth.jwt() nao existe apos as migrations"; exit 1; }
echo "Postgres do Supabase pronto (com migrations do auth)"
echo "::error::Postgres do Supabase nao aceitou conexoes"; exit 1
