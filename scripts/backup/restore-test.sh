#!/usr/bin/env bash
# Teste de restauração em um Postgres DESCARTÁVEL com as dependências reais do Supabase (imagem supabase/postgres:
# schema auth, auth.jwt(), papéis anon/authenticated). Nunca toca em produção.
# Uso: scripts/backup/restore-test.sh <backup.json>      Env: PGHOST PGPORT PGUSER PGPASSWORD
# Logs públicos: erros do psql são filtrados para mostrar só códigos SQLSTATE, nunca valores.
set -euo pipefail
JSON="$1"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
export BACKUP_JSON="$JSON" PGDATABASE="${PGDATABASE:-postgres}" PGTZ=UTC

psqlq() { # $@: argumentos do psql; falha mostrando apenas códigos de erro
  if ! psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate "$@" 2>"$WORK/err"; then
    echo "::error::psql falhou (SQLSTATE: $(grep -oE 'ERROR: +[0-9A-Z]{5}' "$WORK/err" | tr -s ' ' | head -3 | tr '\n' ';'))" >&2
    return 1
  fi
}

echo "aguardando o Postgres do Supabase..."
for i in $(seq 1 60); do
  if psql -X -Atqc "select 1 from pg_namespace where nspname='auth'" 2>/dev/null | grep -q 1; then break; fi
  [ "$i" = 60 ] && { echo "::error::Postgres nao ficou pronto"; exit 1; }
  sleep 2
done
psql -X -Atqc "select 'auth.jwt existe: ' || (to_regprocedure('auth.jwt()') is not null)::text" || true

echo "1/5 estrutura (schema.sql + migration das métricas)"
psqlq -f "$ROOT/schema.sql" >/dev/null
psqlq -f "$ROOT/supabase/migrations/calculate_streamer_metrics.sql" >/dev/null

echo "2/5 restaurando dados"
psqlq -f "$HERE/restore.sql" >/dev/null

echo "3/5 comparando o banco restaurado com o backup"
node "$HERE/print-query.mjs" > "$WORK/q.sql"
psqlq -At -f "$WORK/q.sql" -o "$WORK/restored.json"
node "$HERE/compare.mjs" "$JSON" "$WORK/restored.json"

echo "4/5 políticas de acesso (RLS) com as funções reais do Supabase"
ALLOWED="$(node -e 'const d=JSON.parse(require("fs").readFileSync(process.env.BACKUP_JSON,"utf8"));process.stdout.write(d.tables.allowed_users[0].email)')"
EXPECTED="$(node -e 'const d=JSON.parse(require("fs").readFileSync(process.env.BACKUP_JSON,"utf8"));process.stdout.write(String(d.counts.streamers))')"
as_user() { # $1 = e-mail do token JWT simulado; imprime "permitido|streamers|funcao"
  psql -X -Atq -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -v email="$1" 2>"$WORK/err" <<'SQL' || { echo "::error::consulta RLS falhou (SQLSTATE: $(grep -oE 'ERROR: +[0-9A-Z]{5}' "$WORK/err" | head -2 | tr '\n' ';'))"; return 1; }
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('email', :'email')::text, true) \g /dev/null
select public.is_allowed_user() || '|' || (select count(*) from public.streamers) || '|' || (select count(*) from public.get_streamers_with_live_status());
rollback;
SQL
}
OK="$(as_user "$ALLOWED")"
NO="$(as_user "intruso@example.invalid")"
echo "usuario da lista: $(echo "$OK" | sed 's/^t/permitido/;s/^f/negado/') | estranho: $(echo "$NO" | sed 's/^t/permitido/;s/^f/negado/')"
[ "$OK" = "t|$EXPECTED|$EXPECTED" ] || { echo "::error::usuario permitido nao enxerga todos os streamers"; exit 1; }
[ "$NO" = "f|0|0" ] || { echo "::error::usuario fora da lista enxerga dados (RLS falhou)"; exit 1; }

echo "5/5 função de métricas"
psqlq -Atc "select count(*) >= 0 from public.calculate_streamer_metrics(now() - interval '30 days')" >/dev/null
echo "teste de restauração concluído com sucesso"
