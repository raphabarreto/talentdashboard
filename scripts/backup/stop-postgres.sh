#!/usr/bin/env bash
# Remove o contêiner de teste SOMENTE se ele tiver o rótulo deste teste. Seguro de rodar sempre (if: always()).
set -uo pipefail
docker ps -a --filter "name=^bk-restore-test\$" --filter "label=talentdashboard.backup-test=1" --format '{{.Names}}' | grep -q . \
  && docker rm -f bk-restore-test >/dev/null && echo "contêiner de teste removido"
exit 0
