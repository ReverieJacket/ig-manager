/**
 * Administradores e espaços (migração 012).
 *
 * - `cadastrar`: qualquer pessoa que instalar o Publicador cria a própria
 *   conta de administrador; ela ganha um espaço novo, vazio e separado dos
 *   outros.
 * - `listar` / `criar` / `atualizar` / `redefinirSenha`: o administrador
 *   gerencia outros administradores do MESMO espaço (site → Equipe). Quem é
 *   criado assim recebe senha provisória e troca no primeiro acesso.
 */
const { ErroHttp } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const { noContexto } = require("../lib/espaco");
const { gerarHash, gerarSenhaTemporaria, validarSenhaNova } = require("../lib/senhas");
const espacosRepository = require("../repositories/espacos.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const { PERFIS, versaoDe, entrarApp } = require("./auth.service");
const {
    validarNome,
    validarEmail,
    tratarEmailRepetido,
    usuarioParaAdmin
} = require("./clientes.service");

const log = criarLogger("Administradores");

/**
 * Cadastro pelo Publicador: cria o espaço e o administrador e já devolve o
 * login do app (mesmo formato de `entrarApp`).
 *
 * @param {{nome: string, empresa?: string, email: string, senha: string}} dados
 * @returns {Promise<{usuario: object, token: string}>}
 * @throws {ErroHttp} 400 (dados inválidos) ou 409 (e-mail já cadastrado).
 */
async function cadastrar(dados) {
    const nome = validarNome(dados?.nome, "o seu nome");
    const empresa = String(dados?.empresa ?? "").trim()
        ? validarNome(dados.empresa, "o nome da empresa")
        : nome;
    const email = validarEmail(dados?.email);
    const senha = dados?.senha;

    const erroSenha = validarSenhaNova(senha);
    if (erroSenha) throw new ErroHttp(400, erroSenha);

    if (await usuariosRepository.buscarPorEmail(email)) {
        throw new ErroHttp(409, "Já existe uma conta com esse e-mail. Use \"Entrar\".");
    }

    const espaco = await espacosRepository.criar(empresa);

    try {
        await noContexto(espaco.id, async () =>
            usuariosRepository.criar({
                nome,
                email,
                senha_hash: await gerarHash(senha),
                perfil: PERFIS.ADMIN,
                cliente_id: null,
                senha_temporaria: false
            })
        );
    } catch (erro) {
        // Sem o administrador o espaço ficaria órfão.
        await espacosRepository.excluir(espaco.id).catch(() => {});
        tratarEmailRepetido(erro);
    }

    log.info("Novo administrador cadastrado pelo Publicador", { espacoId: espaco.id });

    return entrarApp({ email, senha });
}

async function buscarAdminOu404(id) {
    const usuario = await usuariosRepository.buscarPorId(id);
    if (!usuario || usuario.perfil !== PERFIS.ADMIN) {
        throw new ErroHttp(404, "Administrador não encontrado.");
    }
    return usuario;
}

/** Administradores do espaço de quem pediu. */
async function listar() {
    const lista = await usuariosRepository.listarAdministradores();
    return lista.map(usuarioParaAdmin);
}

/**
 * Cria outro administrador no espaço de quem pediu, com senha provisória.
 *
 * @param {{nome: string, email: string}} dados
 * @returns {Promise<{usuario: object, senhaTemporaria: string}>}
 */
async function criar(dados) {
    const senhaTemporaria = gerarSenhaTemporaria();

    const usuario = await usuariosRepository
        .criar({
            nome: validarNome(dados?.nome, "o nome da pessoa"),
            email: validarEmail(dados?.email),
            senha_hash: await gerarHash(senhaTemporaria),
            perfil: PERFIS.ADMIN,
            cliente_id: null,
            senha_temporaria: true
        })
        .catch(tratarEmailRepetido);

    log.info("Administrador criado por outro administrador", { usuarioId: usuario.id });

    return { usuario: usuarioParaAdmin(usuario), senhaTemporaria };
}

/**
 * Altera nome, e-mail ou situação de outro administrador do espaço. Não dá
 * para desativar a si mesmo (o espaço poderia ficar sem ninguém).
 */
async function atualizar(id, dados, autorId) {
    const atual = await buscarAdminOu404(id);
    const campos = {};

    if (dados?.nome !== undefined) campos.nome = validarNome(dados.nome, "o nome da pessoa");
    if (dados?.email !== undefined) {
        const email = validarEmail(dados.email);
        if (email !== atual.email) campos.email = email;
    }
    if (dados?.ativo !== undefined) {
        if (typeof dados.ativo !== "boolean") throw new ErroHttp(400, "Valor inválido para 'ativo'.");
        if (dados.ativo === false && id === autorId) {
            throw new ErroHttp(400, "Você não pode desativar o seu próprio acesso.");
        }
        if (dados.ativo !== atual.ativo) campos.ativo = dados.ativo;
    }

    if (Object.keys(campos).length === 0) return usuarioParaAdmin(atual);

    if (campos.email || campos.ativo === false) {
        campos.sessao_versao = versaoDe(atual) + 1;
    }

    const usuario = await usuariosRepository.atualizar(id, campos).catch(tratarEmailRepetido);
    return usuarioParaAdmin(usuario);
}

/** Nova senha provisória para outro administrador do espaço. */
async function redefinirSenha(id, autorId) {
    if (id === autorId) {
        throw new ErroHttp(400, "Para trocar a sua senha, use Meu perfil.");
    }
    const atual = await buscarAdminOu404(id);
    const senhaTemporaria = gerarSenhaTemporaria();

    const usuario = await usuariosRepository.atualizar(id, {
        senha_hash: await gerarHash(senhaTemporaria),
        senha_temporaria: true,
        sessao_versao: versaoDe(atual) + 1
    });

    return { usuario: usuarioParaAdmin(usuario), senhaTemporaria };
}

module.exports = { cadastrar, listar, criar, atualizar, redefinirSenha };
