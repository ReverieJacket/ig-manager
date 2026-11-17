#!/usr/bin/env bash
# =============================================================================
# IG Manager — atualizar o servidor com o que está no GitHub (rodar como ubuntu):
#
#     bash ~/ig-manager/deploy/oracle/atualizar.sh
#
# Baixa o código novo, instala dependências, gera o site de novo e reinicia o
# backend. Os dados (banco, sessões do Instagram, imagens) não são tocados.
# =============================================================================
set -euo pipefail

PASTA="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE="/var/www/ig-manager"

cd "$PASTA"
echo "==> Baixando o código novo"
git pull --ff-only
echo "==> Instalando dependências"
npm install --no-audit --no-fund
(cd backend && npx playwright install chromium)
echo "==> Gerando o site"
npm run build
sudo rm -rf "${SITE:?}/"*
sudo cp -r frontend/dist/. "$SITE/"
echo "==> Reiniciando o backend"
pm2 restart ig-backend --update-env
echo "✓ Atualizado: https://$(cat /etc/ig-manager/endereco)"
