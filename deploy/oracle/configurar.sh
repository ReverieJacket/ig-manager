#!/usr/bin/env bash
# =============================================================================
# IG Manager — configurar e ligar o backend no servidor (rodar como ubuntu):
#
#     bash ~/ig-manager/deploy/oracle/configurar.sh
#
# Pergunta as chaves do Supabase, grava backend/.env (só o dono lê), liga o
# backend com pm2 dentro de uma tela virtual (Xvfb) e o deixa subindo sozinho
# quando a máquina reiniciar. Pode ser rodado de novo para trocar as chaves.
# =============================================================================
set -euo pipefail

PASTA="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV="$PASTA/backend/.env"
ESTADO="/etc/ig-manager"
NOME_PM2="ig-backend"

if [ ! -f "$ESTADO/instalado" ]; then
    echo "A instalação ainda não terminou (ou falhou)."
    echo "Acompanhe com:  tail -f /var/log/ig-manager-instalacao.log"
    exit 1
fi
ENDERECO="$(cat "$ESTADO/endereco")"

echo "============================================================"
echo " Configuração do IG Manager"
echo " Endereço do site: https://${ENDERECO}"
echo "============================================================"
echo "Os valores estão no backend\\.env do seu computador."
echo "(Para colar no terminal: clique com o botão direito.)"
echo

atual() { [ -f "$ENV" ] && grep -E "^$1=" "$ENV" | head -1 | cut -d= -f2- || true; }

perguntar() {
    local nome="$1" texto="$2" secreto="${3:-}" valor padrao
    padrao="$(atual "$nome")"
    while true; do
        if [ -n "$padrao" ]; then
            texto_final="$texto [Enter mantém o atual]: "
        else
            texto_final="$texto: "
        fi
        if [ -n "$secreto" ]; then
            read -r -s -p "$texto_final" valor; echo
        else
            read -r -p "$texto_final" valor
        fi
        valor="${valor:-$padrao}"
        valor="$(echo -n "$valor" | tr -d '[:space:]')"
        [ -n "$valor" ] && break
        echo "  ⚠ Obrigatório."
    done
    printf -v "$nome" '%s' "$valor"
}

perguntar SUPABASE_URL "1/2 SUPABASE_URL (ex.: https://xxxx.supabase.co)"
SUPABASE_URL="${SUPABASE_URL%/}"
SUPABASE_URL="${SUPABASE_URL%/rest/v1}"
perguntar SUPABASE_SERVICE_ROLE_KEY "2/2 SUPABASE_SERVICE_ROLE_KEY (não aparece enquanto digita)" secreto

AUTH_SEGREDO="$(atual AUTH_SEGREDO)"
if [ ${#AUTH_SEGREDO} -lt 32 ]; then
    AUTH_SEGREDO="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
fi

umask 077
cat > "$ENV" <<CONF
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://${ENDERECO}
CORS_ORIGIN=https://${ENDERECO}
AUTH_SEGREDO=${AUTH_SEGREDO}
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
LOG_LEVEL=info
LOG_EM_ARQUIVO=true
# Servidor sem tela: "Conectar" vira "Enviar sessão" (arquivo gerado no PC).
CONEXAO_NO_SERVIDOR=false
CONEXAO_PELO_CLIENTE=false
CONF
chmod 600 "$ENV"
echo
echo "✓ backend/.env gravado."

echo "Testando a conexão com o Supabase..."
if ! (cd "$PASTA" && npm run --silent verificar:conexao); then
    echo
    echo "✗ Não foi possível acessar o Supabase com essas chaves."
    echo "  Confira os valores e rode este script de novo."
    exit 1
fi

echo "Ligando o backend..."
cd "$PASTA/backend"
pm2 delete "$NOME_PM2" >/dev/null 2>&1 || true
pm2 start "xvfb-run -a node src/server.js" --name "$NOME_PM2" --time
pm2 save
sudo env PATH="$PATH:/usr/bin" "$(command -v pm2)" startup systemd -u "$(id -un)" --hp "$HOME" >/dev/null

echo "Aguardando o backend responder..."
for _ in $(seq 1 30); do
    if curl -fsS --max-time 3 http://localhost:3000/ >/dev/null 2>&1; then
        echo
        echo "============================================================"
        echo " ✓ Tudo pronto!"
        echo " Abra no navegador:  https://${ENDERECO}"
        echo " Entre com o mesmo e-mail e senha de administrador de sempre."
        echo "============================================================"
        exit 0
    fi
    sleep 2
done

echo "✗ O backend não respondeu. Veja o erro com:  pm2 logs ${NOME_PM2} --lines 50"
exit 1
