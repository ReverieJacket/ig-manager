/**
 * Middlewares de acesso.
 *
 * - `autenticar`: exige sessão válida; coloca o usuário em `req.usuario`
 *   e o conteúdo do token em `req.sessao`.
 * - `exigirSenhaDefinitiva`: bloqueia quem ainda está com senha temporária
 *   (só pode trocar a senha, ver os próprios dados ou sair).
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
    const resultado = await authService.lerSessao(lerCookie(req, config.auth.nomeCookie));

    if (!resultado) {
        throw new ErroHttp(401, "Sessão expirada ou inexistente. Entre novamente.");
    }

    req.usuario = resultado.usuario;
    req.sessao = resultado.sessao;
    next();
}

function exigirSenhaDefinitiva(req, res, next) {
    if (req.usuario?.senhaTemporaria) {
        throw new ErroHttp(403, "Crie a sua senha antes de continuar.");
    }
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

module.exports = { autenticar, exigirSenhaDefinitiva, exigirPerfil };
