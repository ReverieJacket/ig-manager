/**
 * O Publicador está ligado? (site e telas do administrador)
 *
 * - Modo "api" (Vercel): pelo sinal de vida gravado no banco a cada 30 s.
 * - Modo "completo": o Publicador roda dentro deste mesmo processo.
 */
const { config, MODOS } = require("../config/env");
const { ErroHttp } = require("../lib/erros");
const publicadorRepository = require("../repositories/publicador.repository");

/**
 * @returns {Promise<{modo: string, online: boolean, ultimoSinal: (string|null),
 *   maquina: (string|null), migracaoPendente?: boolean}>}
 */
async function consultar() {
    if (config.modo !== MODOS.API) {
        const ciclo = require("../publicador/ciclo");
        return { modo: config.modo, online: ciclo.estaAtivo(), ultimoSinal: null, maquina: null };
    }

    let linha;
    try {
        linha = await publicadorRepository.ler();
    } catch {
        return { modo: config.modo, online: false, ultimoSinal: null, maquina: null, migracaoPendente: true };
    }

    const sinal = linha?.ultimo_sinal ? new Date(linha.ultimo_sinal).getTime() : 0;

    return {
        modo: config.modo,
        online: Boolean(sinal) && Date.now() - sinal < config.publicador.limiteSemSinalMs,
        ultimoSinal: linha?.ultimo_sinal || null,
        maquina: linha?.maquina || null
    };
}

/**
 * Exige o Publicador ligado para uma ação que precisa do Instagram agora.
 *
 * @param {string} acao - Ex.: "publicar agora".
 * @throws {ErroHttp} 409 com a explicação.
 */
async function exigirOnline(acao) {
    const { online } = await consultar();
    if (!online) {
        throw new ErroHttp(
            409,
            `O Publicador está desligado: para ${acao}, ligue o computador do Publicador ` +
            "(ou abra o app IG Manager Publicador) e tente de novo."
        );
    }
}

module.exports = { consultar, exigirOnline };
