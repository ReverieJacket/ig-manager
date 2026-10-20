/**
 * Limite de tentativas de login erradas, contra adivinhação de senha.
 *
 * Conta falhas por IP + e-mail em memória. Após `tentativasMaximas`
 * falhas dentro da janela, bloqueia até a janela expirar (HTTP 429).
 * Um login certo zera o contador.
 *
 * Em memória basta para um único servidor; com vários processos, o
 * contador precisaria ir para o banco ou um Redis.
 */
const { config } = require("../config/env");
const { ErroHttp } = require("../lib/erros");

/** chave -> { falhas: number, inicio: number } */
const registros = new Map();

function chaveDe(req) {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `${req.ip}|${email}`;
}

function registroValido(chave, agora) {
    const registro = registros.get(chave);
    if (registro && agora - registro.inicio > config.auth.janelaTentativasMs) {
        registros.delete(chave);
        return undefined;
    }
    return registro;
}

/** Middleware: recusa a requisição se a chave estiver bloqueada. */
function limitarLogin(req, res, next) {
    const agora = Date.now();
    const registro = registroValido(chaveDe(req), agora);

    if (registro && registro.falhas >= config.auth.tentativasMaximas) {
        const minutos = Math.ceil(
            (registro.inicio + config.auth.janelaTentativasMs - agora) / 60000
        );
        res.setHeader("Retry-After", String(minutos * 60));
        throw new ErroHttp(
            429,
            `Muitas tentativas de login. Tente novamente em ${minutos} minuto(s).`
        );
    }

    next();
}

function registrarFalha(req) {
    const chave = chaveDe(req);
    const agora = Date.now();
    const registro = registroValido(chave, agora) || { falhas: 0, inicio: agora };

    registro.falhas += 1;
    registros.set(chave, registro);
}

function registrarSucesso(req) {
    registros.delete(chaveDe(req));
}

/** Limpeza periódica para o mapa não crescer sem limite. */
setInterval(() => {
    const agora = Date.now();
    for (const chave of registros.keys()) registroValido(chave, agora);
}, config.auth.janelaTentativasMs).unref();

module.exports = { limitarLogin, registrarFalha, registrarSucesso };
