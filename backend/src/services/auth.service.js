/**
 * Regras de autenticação: login, leitura da sessão e formato público do
 * usuário. Não conhece HTTP (cookies ficam nas rotas/middlewares).
 */
const { config } = require("../config/env");
const { ErroHttp, formatarErro } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const { conferirSenha, gerarHash } = require("../lib/senhas");
const tokens = require("../lib/tokens");
const usuariosRepository = require("../repositories/usuarios.repository");

const log = criarLogger("Auth");

const PERFIS = Object.freeze({ ADMIN: "admin", CLIENTE: "cliente" });

/** Mesma mensagem para e-mail inexistente e senha errada (não revela qual). */
const MENSAGEM_CREDENCIAIS = "E-mail ou senha incorretos.";

/**
 * Hash de uma senha qualquer, usado para gastar o mesmo tempo quando o
 * e-mail não existe (sem isso, a resposta rápida revelaria o cadastro).
 */
const hashFicticio = gerarHash("senha-ficticia-para-tempo-constante");

/**
 * Formato do usuário devolvido ao frontend (nunca inclui o hash).
 *
 * @param {object} usuario - Registro do repositório.
 * @returns {{id: number, nome: string, email: string, perfil: string,
 *            cliente: ({id: number, nome: string}|null)}}
 */
function usuarioPublico(usuario) {
    return {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        cliente: usuario.clientes
            ? { id: usuario.clientes.id, nome: usuario.clientes.nome }
            : null
    };
}

/**
 * Um usuário só pode usar o sistema se estiver ativo e, sendo cliente,
 * se o cliente também estiver ativo.
 */
function podeAcessar(usuario) {
    if (!usuario || !usuario.ativo) return false;
    if (usuario.perfil === PERFIS.CLIENTE && usuario.clientes?.ativo === false) return false;
    return true;
}

/**
 * Valida e-mail e senha e cria o token de sessão.
 *
 * @param {{email: string, senha: string, manterConectado?: boolean}} dados
 * @returns {Promise<{usuario: object, token: string, duracaoCookieMs: (number|null)}>}
 * @throws {ErroHttp} 400 (dados ausentes) ou 401 (credenciais/usuário inativo).
 */
async function entrar({ email, senha, manterConectado }) {
    if (typeof email !== "string" || !email.trim() || typeof senha !== "string" || !senha) {
        throw new ErroHttp(400, "Informe o e-mail e a senha.");
    }

    const usuario = await usuariosRepository.buscarParaLogin(email);
    const senhaConfere = await conferirSenha(senha, usuario ? usuario.senha_hash : await hashFicticio);

    if (!usuario || !senhaConfere) {
        throw new ErroHttp(401, MENSAGEM_CREDENCIAIS);
    }

    if (!podeAcessar(usuario)) {
        throw new ErroHttp(401, "Este acesso está desativado. Fale com o administrador.");
    }

    const duracaoMs = manterConectado ? config.auth.duracaoLongaMs : config.auth.duracaoPadraoMs;
    const token = tokens.assinar({ sub: usuario.id, perfil: usuario.perfil }, duracaoMs);

    usuariosRepository.registrarAcesso(usuario.id).catch((erro) => {
        log.aviso(`Não foi possível registrar o acesso do usuário ${usuario.id}`, formatarErro(erro));
    });

    log.info("Login realizado", { usuarioId: usuario.id, perfil: usuario.perfil });

    return {
        usuario: usuarioPublico(usuario),
        token,
        // Sem "manter conectado" o cookie some ao fechar o navegador.
        duracaoCookieMs: manterConectado ? duracaoMs : null
    };
}

/**
 * Lê a sessão a partir do token. Relê o usuário no banco a cada chamada,
 * para que desativar alguém tenha efeito imediato.
 *
 * @param {string|undefined} token
 * @returns {Promise<object|null>} Usuário público, ou `null` se inválida.
 */
async function lerSessao(token) {
    const dados = tokens.verificar(token);
    if (!dados || !Number.isSafeInteger(dados.sub)) return null;

    const usuario = await usuariosRepository.buscarPorId(dados.sub);
    if (!podeAcessar(usuario)) return null;

    return usuarioPublico(usuario);
}

module.exports = { PERFIS, entrar, lerSessao, usuarioPublico };
