/**
 * Regras de autenticação: login, leitura da sessão, troca de senha e
 * formato público do usuário. Não conhece HTTP (cookies ficam nas
 * rotas/middlewares).
 *
 * Cada token carrega a `sessao_versao` do usuário (`v`). Trocar a senha ou
 * o e-mail, redefinir a senha ou desativar o usuário aumenta essa versão,
 * e todos os tokens antigos deixam de valer na hora.
 */
const { config } = require("../config/env");
const { ErroHttp, formatarErro } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const { conferirSenha, gerarHash, validarSenhaNova } = require("../lib/senhas");
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
 */
function usuarioPublico(usuario) {
    return {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        senhaTemporaria: Boolean(usuario.senha_temporaria),
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

/** Versão da sessão gravada no banco (1 antes da migração 005). */
function versaoDe(usuario) {
    return Number.isSafeInteger(usuario.sessao_versao) ? usuario.sessao_versao : 1;
}

/**
 * Cria o token de sessão de um usuário.
 *
 * @param {object} usuario - Registro do repositório.
 * @param {boolean} manterConectado
 * @returns {{token: string, duracaoCookieMs: (number|null)}}
 */
function emitirSessao(usuario, manterConectado) {
    const duracaoMs = manterConectado ? config.auth.duracaoLongaMs : config.auth.duracaoPadraoMs;

    return {
        token: tokens.assinar(
            { sub: usuario.id, perfil: usuario.perfil, v: versaoDe(usuario), longa: Boolean(manterConectado) },
            duracaoMs
        ),
        // Sem "manter conectado" o cookie some ao fechar o navegador.
        duracaoCookieMs: manterConectado ? duracaoMs : null
    };
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

    usuariosRepository.registrarAcesso(usuario.id).catch((erro) => {
        log.aviso(`Não foi possível registrar o acesso do usuário ${usuario.id}`, formatarErro(erro));
    });

    log.info("Login realizado", { usuarioId: usuario.id, perfil: usuario.perfil });

    return { usuario: usuarioPublico(usuario), ...emitirSessao(usuario, manterConectado) };
}

/**
 * Lê a sessão a partir do token. Relê o usuário no banco a cada chamada,
 * para que desativar alguém ou trocar a senha tenha efeito imediato.
 *
 * @param {string|undefined} token
 * @returns {Promise<{usuario: object, sessao: object}|null>} `null` se inválida.
 */
async function lerSessao(token) {
    const dados = tokens.verificar(token);
    if (!dados || !Number.isSafeInteger(dados.sub)) return null;

    const usuario = await usuariosRepository.buscarPorId(dados.sub);
    if (!podeAcessar(usuario)) return null;

    // Senha/e-mail trocados depois que este token foi emitido.
    if ((dados.v ?? 1) !== versaoDe(usuario)) return null;

    return { usuario: usuarioPublico(usuario), sessao: dados };
}

/**
 * Troca a senha do próprio usuário. Encerra as sessões em outros
 * aparelhos e devolve um token novo para a sessão atual continuar.
 *
 * No primeiro acesso (senha temporária) a senha atual não é pedida de novo:
 * a pessoa acabou de entrar com ela.
 *
 * @param {{usuarioId: number, senhaAtual: string, senhaNova: string,
 *          manterConectado: boolean, exigirSenhaAtual: boolean}} dados
 * @throws {ErroHttp} 400 (senha nova inválida) ou 401 (senha atual errada).
 */
async function trocarSenha({ usuarioId, senhaAtual, senhaNova, manterConectado, exigirSenhaAtual = true }) {
    const erroSenha = validarSenhaNova(senhaNova);
    if (erroSenha) throw new ErroHttp(400, erroSenha);

    const hashAtual = await usuariosRepository.buscarHashPorId(usuarioId);

    if (!hashAtual) throw new ErroHttp(401, "Sessão inválida. Entre novamente.");

    if (exigirSenhaAtual && !(await conferirSenha(String(senhaAtual ?? ""), hashAtual))) {
        throw new ErroHttp(401, "A senha atual está incorreta.");
    }

    if (await conferirSenha(senhaNova, hashAtual)) {
        throw new ErroHttp(400, "A nova senha precisa ser diferente da atual.");
    }

    const atual = await usuariosRepository.buscarPorId(usuarioId);
    const usuario = await usuariosRepository.atualizar(usuarioId, {
        senha_hash: await gerarHash(senhaNova),
        senha_temporaria: false,
        sessao_versao: versaoDe(atual) + 1
    });

    log.info("Senha trocada pelo próprio usuário", { usuarioId });

    return { usuario: usuarioPublico(usuario), ...emitirSessao(usuario, manterConectado) };
}

/**
 * Atualiza o nome exibido do próprio usuário.
 *
 * @param {number} usuarioId
 * @param {unknown} nome
 */
async function atualizarNome(usuarioId, nome) {
    const limpo = String(nome ?? "").trim();

    if (!limpo || limpo.length > 120) {
        throw new ErroHttp(400, "Informe um nome com até 120 caracteres.");
    }

    return usuarioPublico(await usuariosRepository.atualizar(usuarioId, { nome: limpo }));
}

module.exports = {
    PERFIS,
    entrar,
    lerSessao,
    trocarSenha,
    atualizarNome,
    usuarioPublico,
    versaoDe
};
