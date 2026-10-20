/**
 * Middlewares de acesso.
 *
 * - `autenticar`: exige sessão válida e coloca o usuário em `req.usuario`.
 * - `exigirPerfil(...perfis)`: exige um dos perfis informados.
 *
 * Regra de ouro para as rotas do cliente: o `cliente_id` usado nas
 * consultas vem SEMPRE de `req.usuario.cliente.id`, nunca da URL/corpo.
 */
const { config } = require("../config/env");
const { ErroHttp } = require("../lib/erros");
const { lerCookie } = require("../lib/cookies");
const authService = require("../services/auth.service");

async function autenticar(req, res, next) {
    const usuario = await authService.lerSessao(lerCookie(req, config.auth.nomeCookie));

    if (!usuario) {
        throw new ErroHttp(401, "Sessão expirada ou inexistente. Entre novamente.");
    }

    req.usuario = usuario;
    next();
}

/**
 * @param {...string} perfis - Ex.: `exigirPerfil("admin")`.
 */
function exigirPerfil(...perfis) {
    return function verificarPerfil(req, res, next) {
        if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
            throw new ErroHttp(403, "Você não tem permissão para acessar este recurso.");
        }
        next();
    };
}

module.exports = { autenticar, exigirPerfil };
