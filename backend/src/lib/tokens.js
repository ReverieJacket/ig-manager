/**
 * Tokens de sessão assinados (formato JWT, algoritmo HS256).
 *
 * Implementado com o `crypto` do Node para não adicionar dependência: o
 * token só é criado e lido por este backend, então basta HMAC-SHA256 com
 * um segredo forte (`AUTH_SEGREDO`).
 *
 * O token viaja num cookie httpOnly; o JavaScript do navegador não o lê.
 */
const crypto = require("crypto");

const { config, exigirVariaveis } = require("../config/env");

exigirVariaveis(["AUTH_SEGREDO"]);

if (config.auth.segredo.length < 32) {
    throw new Error(
        "AUTH_SEGREDO deve ter pelo menos 32 caracteres (veja backend/.env.example)."
    );
}

const CABECALHO = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

function base64url(valor) {
    return Buffer.from(valor).toString("base64url");
}

function assinatura(conteudo) {
    return crypto
        .createHmac("sha256", config.auth.segredo)
        .update(conteudo)
        .digest("base64url");
}

/**
 * Cria um token.
 *
 * @param {object} dados - Conteúdo (ex.: `{ sub: 1, perfil: "admin" }`).
 * @param {number} duracaoMs - Validade a partir de agora.
 * @returns {string}
 */
function assinar(dados, duracaoMs) {
    const agora = Math.floor(Date.now() / 1000);
    const corpo = base64url(
        JSON.stringify({ ...dados, iat: agora, exp: agora + Math.floor(duracaoMs / 1000) })
    );
    const conteudo = `${CABECALHO}.${corpo}`;

    return `${conteudo}.${assinatura(conteudo)}`;
}

/**
 * Valida um token e devolve o conteúdo.
 *
 * @param {unknown} token
 * @returns {object|null} `null` se ausente, adulterado ou expirado.
 */
function verificar(token) {
    if (typeof token !== "string") return null;

    const partes = token.split(".");
    if (partes.length !== 3 || partes[0] !== CABECALHO) return null;

    const esperada = Buffer.from(assinatura(`${partes[0]}.${partes[1]}`));
    const recebida = Buffer.from(partes[2]);

    if (
        esperada.length !== recebida.length ||
        !crypto.timingSafeEqual(esperada, recebida)
    ) {
        return null;
    }

    try {
        const dados = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));

        if (!Number.isFinite(dados.exp) || dados.exp <= Date.now() / 1000) return null;

        return dados;
    } catch {
        return null;
    }
}

module.exports = { assinar, verificar };
