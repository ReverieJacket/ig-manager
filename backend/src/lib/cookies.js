/**
 * Leitura e escrita do cookie de sessão, sem dependência extra.
 */
const { config } = require("../config/env");

/**
 * Lê um cookie do cabeçalho da requisição.
 *
 * @param {import("express").Request} req
 * @param {string} nome
 * @returns {string|undefined}
 */
function lerCookie(req, nome) {
    const cabecalho = req.headers.cookie;
    if (!cabecalho) return undefined;

    for (const parte of cabecalho.split(";")) {
        const indice = parte.indexOf("=");
        if (indice === -1) continue;

        if (parte.slice(0, indice).trim() === nome) {
            try {
                return decodeURIComponent(parte.slice(indice + 1).trim());
            } catch {
                return undefined;
            }
        }
    }

    return undefined;
}

/** Opções comuns do cookie de sessão. */
function opcoesBase() {
    return {
        httpOnly: true, // o JavaScript da página não consegue ler
        sameSite: "lax", // não é enviado em POSTs vindos de outros sites
        secure: config.emProducao, // só por HTTPS em produção
        path: "/"
    };
}

/**
 * Grava o cookie de sessão.
 *
 * @param {import("express").Response} res
 * @param {string} token
 * @param {number|null} duracaoMs - `null` = cookie de sessão do navegador
 *   (some ao fechar o navegador); o token em si expira sozinho.
 */
function gravarSessao(res, token, duracaoMs) {
    res.cookie(config.auth.nomeCookie, token, {
        ...opcoesBase(),
        ...(duracaoMs ? { maxAge: duracaoMs } : {})
    });
}

/** Apaga o cookie de sessão. */
function apagarSessao(res) {
    res.clearCookie(config.auth.nomeCookie, opcoesBase());
}

module.exports = { lerCookie, gravarSessao, apagarSessao };
