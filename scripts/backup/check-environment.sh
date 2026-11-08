#!/usr/bin/env bash
# TRAVA OBRIGATÓRIA ANTES DE CADASTRAR QUALQUER SECRET: confirma que o ambiente "backup" existe e só aceita o ramo main,
# e que o token NÃO está como secret do repositório (secret de repositório ignora a restrição do ambiente).
# Somente leitura. Precisa do `gh` autenticado com permissão de administrador no repositório (rodar no computador do dono).
# Uso: scripts/backup/check-environment.sh [dono/repositorio]
# Saída: 0 = seguro para cadastrar o secret no ambiente; 1 = NÃO cadastrar.
set -uo pipefail
REPO="${1:-raphabarreto/talentdashboard}"
ENV_NAME="backup"
SECRET_NAME="SUPABASE_BACKUP_TOKEN"
bad=0
fail() { echo "FALHA: $1"; bad=1; }

if ! gh api "repos/${REPO}/environments/${ENV_NAME}" >/dev/null 2>&1; then
  echo "FALHA: o ambiente '${ENV_NAME}' nao existe (ou sem permissao de administrador). Crie-o e restrinja a main ANTES do secret."
  exit 1
fi

custom="$(gh api "repos/${REPO}/environments/${ENV_NAME}" --jq '.deployment_branch_policy.custom_branch_policies // false')"
protected="$(gh api "repos/${REPO}/environments/${ENV_NAME}" --jq '.deployment_branch_policy.protected_branches // false')"
if [ "$custom" != "true" ]; then
  fail "o ambiente nao usa 'ramos selecionados' (custom_branch_policies=${custom}); qualquer ramo poderia receber o token"
else
  names="$(gh api "repos/${REPO}/environments/${ENV_NAME}/deployment-branch-policies" --jq '[.branch_policies[] | "\(.type):\(.name)"] | sort | join(",")')"
  if [ "$names" != "branch:main" ]; then fail "regras de ramo do ambiente devem ser exatamente 'main' (encontrado: ${names:-nenhuma})"; fi
fi
if [ "$protected" = "true" ]; then fail "o ambiente usa 'ramos protegidos' em vez de 'somente main'; ajuste para ramos selecionados = main"; fi

if gh api "repos/${REPO}/actions/secrets" --jq '.secrets[].name' 2>/dev/null | grep -qx "$SECRET_NAME"; then
  fail "existe secret de REPOSITORIO chamado ${SECRET_NAME}; remova-o e cadastre-o somente no ambiente '${ENV_NAME}'"
fi
if gh api "repos/${REPO}/actions/organization-secrets" --jq '.secrets[].name' 2>/dev/null | grep -qx "$SECRET_NAME"; then
  fail "existe secret de ORGANIZACAO chamado ${SECRET_NAME}"
fi

if [ "$bad" = 0 ]; then
  echo "OK: ambiente '${ENV_NAME}' restrito a main e sem ${SECRET_NAME} em outros escopos. Pode cadastrar o secret NO AMBIENTE."
fi
exit "$bad"
