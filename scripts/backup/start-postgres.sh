#!/usr/bin/env bash
# Sobe um Postgres DESCARTÁVEL da imagem oficial do Supabase e espera o servidor DEFINITIVO ficar pronto.
# (A imagem inicia um servidor temporário para rodar as migrations internas e depois reinicia; um "service container"
# comum acha que já está saudável durante essa fase.) Uso: scripts/backup/start-postgres.sh
set -euo pipefail
IMAGE="supabase/postgres:17.6.1.178"
docker rm -f bk-pg >/dev/null 2>&1 || true
docker run -d --name bk-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 "$IMAGE" >/dev/null
for i in $(seq 1 90); do
  if docker logs bk-pg 2>&1 | grep -q "init process complete"; then break; fi
  [ "$i" = 90 ] && { echo "::error::inicializacao do Postgres do Supabase nao terminou"; docker logs bk-pg 2>&1 | grep -E "ERROR|FATAL" | head -5; exit 1; }
  sleep 2
done
for i in $(seq 1 60); do
  if PGPASSWORD=postgres psql -X -h localhost -U postgres -Atqc "select 1" 2>/dev/null | grep -q 1; then echo "Postgres do Supabase pronto"; exit 0; fi
  sleep 2
done
echo "::error::Postgres do Supabase nao aceitou conexoes"; exit 1
