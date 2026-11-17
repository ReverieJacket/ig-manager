#!/usr/bin/env bash
# =============================================================================
# IG Manager — instalação automática num servidor Ubuntu da Oracle Cloud
# (Always Free, Ampere A1). Roda UMA vez, como root, na primeira inicialização
# da máquina (cloud-init) ou manualmente:
#
#     curl -fsSL https://raw.githubusercontent.com/ReverieJacket/ig-manager/main/deploy/oracle/instalar.sh | sudo bash
#
# O que faz:
#   1. Atualiza o sistema e libera as portas 80/443 no firewall interno.
#   2. Cria 2 GB de swap (folga de memória para o Chromium).
#   3. Instala Node 24, git, Xvfb (tela virtual), pm2 e Caddy (HTTPS).
#   4. Baixa o projeto, instala as dependências e o Chromium do Playwright.
#   5. Descobre o IP público e monta o endereço https://<ip-com-traços>.sslip.io
#   6. Gera o site (frontend) e configura o Caddy.
#
# O backend só é ligado depois, pelo `configurar.sh` (que pede as chaves do
# Supabase). Acompanhe o progresso em /var/log/ig-manager-instalacao.log.
# =============================================================================
set -euo pipefail

REPO="${IGM_REPO:-https://github.com/ReverieJacket/ig-manager.git}"
BRANCH="${IGM_BRANCH:-main}"
USUARIO="ubuntu"
PASTA="/home/${USUARIO}/ig-manager"
SITE="/var/www/ig-manager"
ESTADO="/etc/ig-manager"
LOG="/var/log/ig-manager-instalacao.log"

exec > >(tee -a "$LOG") 2>&1
etapa() { echo; echo "==> [$(date '+%H:%M:%S')] $*"; }

if [ "$(id -u)" -ne 0 ]; then
    echo "Rode como root (sudo)." >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

etapa "1/6 Atualizando o sistema"
apt-get update -y
apt-get upgrade -y

etapa "Liberando as portas 80 e 443 no firewall interno"
for porta in 80 443; do
    if ! iptables -C INPUT -m state --state NEW -p tcp --dport "$porta" -j ACCEPT 2>/dev/null; then
        iptables -I INPUT 6 -m state --state NEW -p tcp --dport "$porta" -j ACCEPT
    fi
done
if command -v netfilter-persistent >/dev/null; then
    netfilter-persistent save
fi

etapa "2/6 Criando 2 GB de swap"
if ! swapon --show | grep -q '/swapfile'; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

etapa "3/6 Instalando Node 24, git, Xvfb, pm2 e Caddy"
apt-get install -y curl ca-certificates gnupg git xvfb debian-keyring debian-archive-keyring apt-transport-https
if ! command -v node >/dev/null || ! node -v | grep -q '^v24'; then
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y nodejs
fi
npm install -g pm2

if ! command -v caddy >/dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
        | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
        > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy
fi

etapa "4/6 Baixando o projeto (${BRANCH}) e instalando dependências"
if [ ! -d "$PASTA/.git" ]; then
    sudo -H -u "$USUARIO" git clone --branch "$BRANCH" "$REPO" "$PASTA"
else
    sudo -H -u "$USUARIO" git -C "$PASTA" pull --ff-only
fi
sudo -H -u "$USUARIO" bash -c "cd '$PASTA' && npm install --no-audit --no-fund"
(cd "$PASTA/backend" && npx --yes playwright install-deps chromium)
sudo -H -u "$USUARIO" bash -c "cd '$PASTA/backend' && npx playwright install chromium"
sudo -H -u "$USUARIO" mkdir -p "$PASTA/backend/storage/instagram-sessoes"

etapa "5/6 Descobrindo o endereço público"
IP=""
for servico in https://api.ipify.org https://ifconfig.me https://icanhazip.com; do
    IP="$(curl -fsS --max-time 10 "$servico" | tr -d '[:space:]' || true)"
    [[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && break
    IP=""
done
if [ -z "$IP" ]; then
    echo "Não foi possível descobrir o IP público. Rode de novo mais tarde." >&2
    exit 1
fi
ENDERECO="${IP//./-}.sslip.io"
mkdir -p "$ESTADO"
echo "$ENDERECO" > "$ESTADO/endereco"
echo "Endereço do site: https://${ENDERECO}"

etapa "6/6 Gerando o site e configurando o Caddy"
echo "VITE_API_URL=https://${ENDERECO}/api" > "$PASTA/frontend/.env.production"
chown "$USUARIO:$USUARIO" "$PASTA/frontend/.env.production"
sudo -H -u "$USUARIO" bash -c "cd '$PASTA' && npm run build"
mkdir -p "$SITE"
rm -rf "${SITE:?}/"*
cp -r "$PASTA/frontend/dist/." "$SITE/"

cat > /etc/caddy/Caddyfile <<CADDY
${ENDERECO} {
    encode gzip
    handle_path /api/* {
        reverse_proxy localhost:3000
    }
    handle {
        root * ${SITE}
        try_files {path} /index.html
        file_server
    }
}
CADDY
systemctl enable caddy
systemctl restart caddy

date -Iseconds > "$ESTADO/instalado"
echo
echo "============================================================"
echo " Instalação concluída."
echo " Endereço: https://${ENDERECO}"
echo " Próximo passo: entre por SSH e rode"
echo "     bash ~/ig-manager/deploy/oracle/configurar.sh"
echo "============================================================"
