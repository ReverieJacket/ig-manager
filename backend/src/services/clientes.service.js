/**
 * Regras da tela "Clientes" do administrador: clientes, usuários de
 * acesso de cada cliente e visão das contas do Instagram deles.
 *
 * Senhas: o administrador nunca define nem vê a senha de um cliente. Ao
 * criar um usuário ou redefinir a senha, o sistema gera uma senha
 * TEMPORÁRIA, devolvida uma única vez; no primeiro acesso o cliente é
 * obrigado a criar a dele.
 */
const { ErroHttp, formatarErro } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const { gerarHash, gerarSenhaTemporaria } = require("../lib/senhas");
const clientesRepository = require("../repositories/clientes.repository");
const contasRepository = require("../repositories/contas.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const { desconectar } = require("./instagram-auth.service");
const { perfilParaTela, statusDe, STATUS_PERFIL } = require("./perfis.service");
const { PERFIS, versaoDe } = require("./auth.service");

const log = criarLogger("Clientes");

/* ------------------------------- validações ------------------------------ */

function validarNome(valor, rotulo) {
    const nome = String(valor ?? "").trim();
    if (!nome || nome.length > 120) {
        throw new ErroHttp(400, `Informe ${rotulo} com até 120 caracteres.`);
    }
    return nome;
}

function validarEmail(valor) {
    const email = usuariosRepository.normalizarEmail(valor);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ErroHttp(400, "Informe um e-mail válido.");
    }
    return email;
}

/** Converte "e-mail já usado" do banco em mensagem clara. */
function tratarEmailRepetido(erro) {
    if (erro?.code === usuariosRepository.VIOLACAO_UNICA) {
        throw new ErroHttp(409, "Já existe um usuário com esse e-mail.");
    }
    throw erro;
}

/* -------------------------------- formatos ------------------------------- */

/** Usuário como aparece para o administrador (sem hash). */
function usuarioParaAdmin(u) {
    return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        ativo: u.ativo,
        senhaTemporaria: Boolean(u.senha_temporaria),
        ultimoAcesso: u.ultimo_acesso,
        criadoEm: u.criado_em
    };
}

/** Perfil do Instagram com o status da conexão (ver `perfis.service`). */
function contaComStatus(c) {
    return perfilParaTela(c);
}

/* --------------------------------- leitura -------------------------------- */

/**
 * Lista os clientes com contadores para a coluna da esquerda.
 */
async function listar() {
    const clientes = await clientesRepository.listarComResumo();

    return clientes.map((c) => {
        const usuarios = (c.usuarios || []).filter((u) => u.ativo);
        const contas = (c.contas_instagram || []).filter((conta) => conta.ativo);

        return {
            id: c.id,
            nome: c.nome,
            ativo: c.ativo,
            criadoEm: c.criado_em,
            totalUsuarios: usuarios.length,
            totalContas: contas.length,
            primeiroAcessoPendente: usuarios.filter((u) => u.senha_temporaria).length,
            contasAguardando: contas.filter((conta) => statusDe(conta) === STATUS_PERFIL.AGUARDANDO).length,
            contasExpiradas: contas.filter((conta) => statusDe(conta) === STATUS_PERFIL.EXPIRADA).length
        };
    });
}

async function buscarClienteOu404(id) {
    const cliente = await clientesRepository.buscarPorId(id);
    if (!cliente) throw new ErroHttp(404, "Cliente não encontrado.");
    return cliente;
}

/**
 * Detalhe de um cliente: dados, usuários e contas do Instagram.
 */
async function detalhar(id) {
    const cliente = await buscarClienteOu404(id);
    const [usuarios, contas] = await Promise.all([
        usuariosRepository.listarPorCliente(id),
        contasRepository.listarPorCliente(id)
    ]);

    return {
        cliente: { id: cliente.id, nome: cliente.nome, ativo: cliente.ativo, criadoEm: cliente.criado_em },
        usuarios: usuarios.map(usuarioParaAdmin),
        contas: contas.filter((c) => c.ativo).map(contaComStatus)
    };
}

/* -------------------------------- escrita -------------------------------- */

/**
 * Cria um usuário cliente com senha temporária.
 *
 * @returns {Promise<{usuario: object, senhaTemporaria: string}>}
 */
async function criarUsuarioCliente(clienteId, { nome, email }) {
    const senhaTemporaria = gerarSenhaTemporaria();

    const usuario = await usuariosRepository
        .criar({
            nome: validarNome(nome, "o nome da pessoa"),
            email: validarEmail(email),
            senha_hash: await gerarHash(senhaTemporaria),
            perfil: PERFIS.CLIENTE,
            cliente_id: clienteId,
            senha_temporaria: true
        })
        .catch(tratarEmailRepetido);

    return { usuario: usuarioParaAdmin(usuario), senhaTemporaria };
}

/**
 * Cria um cliente e o primeiro usuário de acesso dele.
 *
 * @param {{nome: string, usuario: {nome: string, email: string}}} dados
 */
async function criar(dados) {
    const nomeCliente = validarNome(dados?.nome, "o nome do cliente");
    // Valida o usuário ANTES de criar o cliente, para não sobrar cliente sem usuário.
    validarNome(dados?.usuario?.nome, "o nome da pessoa");
    const email = validarEmail(dados?.usuario?.email);

    if (await usuariosRepository.buscarPorEmail(email)) {
        throw new ErroHttp(409, "Já existe um usuário com esse e-mail.");
    }

    const cliente = await clientesRepository.criar(nomeCliente).catch((erro) => {
        if (erro?.code === clientesRepository.VIOLACAO_UNICA) {
            throw new ErroHttp(409, "Já existe um cliente com esse nome.");
        }
        throw erro;
    });

    const { usuario, senhaTemporaria } = await criarUsuarioCliente(cliente.id, dados.usuario);

    log.info("Cliente criado", { clienteId: cliente.id, usuarioId: usuario.id });

    return {
        cliente: { id: cliente.id, nome: cliente.nome, ativo: cliente.ativo },
        usuario,
        senhaTemporaria
    };
}

/**
 * Renomeia, desativa ou reativa um cliente. Desativar bloqueia o acesso
 * de todos os usuários dele na hora (ver `podeAcessar`).
 *
 * @param {number} id
 * @param {{nome?: string, ativo?: boolean}} dados
 */
async function atualizar(id, dados) {
    await buscarClienteOu404(id);

    const campos = {};
    if (dados?.nome !== undefined) campos.nome = validarNome(dados.nome, "o nome do cliente");
    if (dados?.ativo !== undefined) {
        if (typeof dados.ativo !== "boolean") throw new ErroHttp(400, "Valor inválido para 'ativo'.");
        campos.ativo = dados.ativo;
    }
    if (Object.keys(campos).length === 0) throw new ErroHttp(400, "Nada para alterar.");

    const cliente = await clientesRepository.atualizar(id, campos).catch((erro) => {
        if (erro?.code === clientesRepository.VIOLACAO_UNICA) {
            throw new ErroHttp(409, "Já existe um cliente com esse nome.");
        }
        throw erro;
    });

    log.info("Cliente atualizado", { clienteId: id, campos: Object.keys(campos) });

    return { id: cliente.id, nome: cliente.nome, ativo: cliente.ativo };
}

/**
 * Adiciona outro usuário de acesso a um cliente existente.
 */
async function adicionarUsuario(clienteId, dados) {
    const cliente = await buscarClienteOu404(clienteId);
    if (!cliente.ativo) throw new ErroHttp(400, "Reative o cliente antes de adicionar usuários.");

    const resultado = await criarUsuarioCliente(clienteId, dados || {});
    log.info("Usuário adicionado ao cliente", { clienteId, usuarioId: resultado.usuario.id });

    return resultado;
}

/** Só usuários de perfil cliente são gerenciados por esta tela. */
async function buscarUsuarioClienteOu404(id) {
    const usuario = await usuariosRepository.buscarPorId(id);
    if (!usuario || usuario.perfil !== PERFIS.CLIENTE) {
        throw new ErroHttp(404, "Usuário não encontrado.");
    }
    return usuario;
}

/**
 * Gera uma nova senha temporária e encerra as sessões abertas do usuário.
 */
async function redefinirSenha(usuarioId) {
    const atual = await buscarUsuarioClienteOu404(usuarioId);
    const senhaTemporaria = gerarSenhaTemporaria();

    const usuario = await usuariosRepository.atualizar(usuarioId, {
        senha_hash: await gerarHash(senhaTemporaria),
        senha_temporaria: true,
        sessao_versao: versaoDe(atual) + 1
    });

    log.info("Senha redefinida pelo administrador", { usuarioId });

    return { usuario: usuarioParaAdmin(usuario), senhaTemporaria };
}

/**
 * Altera nome, e-mail ou situação (ativo) de um usuário cliente.
 * Trocar o e-mail ou desativar encerra as sessões abertas dele.
 *
 * @param {number} usuarioId
 * @param {{nome?: string, email?: string, ativo?: boolean}} dados
 */
async function atualizarUsuario(usuarioId, dados) {
    const atual = await buscarUsuarioClienteOu404(usuarioId);
    const campos = {};

    if (dados?.nome !== undefined) campos.nome = validarNome(dados.nome, "o nome da pessoa");
    if (dados?.email !== undefined) {
        const email = validarEmail(dados.email);
        if (email !== atual.email) campos.email = email;
    }
    if (dados?.ativo !== undefined) {
        if (typeof dados.ativo !== "boolean") throw new ErroHttp(400, "Valor inválido para 'ativo'.");
        if (dados.ativo !== atual.ativo) campos.ativo = dados.ativo;
    }

    if (Object.keys(campos).length === 0) return usuarioParaAdmin(atual);

    if (campos.email || campos.ativo === false) {
        campos.sessao_versao = versaoDe(atual) + 1;
    }

    const usuario = await usuariosRepository.atualizar(usuarioId, campos).catch(tratarEmailRepetido);

    log.info("Usuário atualizado pelo administrador", {
        usuarioId,
        campos: Object.keys(campos).filter((c) => c !== "sessao_versao")
    });

    return usuarioParaAdmin(usuario);
}

/**
 * Exclui definitivamente o cliente, os usuários e as contas do Instagram
 * dele (inclusive as sessões salvas do Instagram). Não pode ser desfeito.
 *
 * @throws {ErroHttp} 404 (não existe) ou 409 (alguma conta já tem publicações).
 */
async function excluir(id) {
    const cliente = await buscarClienteOu404(id);

    let resultado;
    try {
        resultado = await clientesRepository.excluir(id);
    } catch (erro) {
        const mensagem = String(erro?.message || "");

        if (mensagem.startsWith("CONTA_COM_PUBLICACOES:")) {
            const conta = mensagem.split(":")[1];
            throw new ErroHttp(
                409,
                `A conta @${conta} já tem publicações. Para manter o histórico, ` +
                "desative o cliente em vez de excluir."
            );
        }
        if (mensagem.startsWith("CLIENTE_NAO_ENCONTRADO")) {
            throw new ErroHttp(404, "Cliente não encontrado.");
        }
        // Função ainda não criada no banco.
        if (erro?.code === "PGRST202" || /excluir_cliente/.test(mensagem)) {
            throw new ErroHttp(
                500,
                "Exclusão indisponível: execute a migração 006_excluir_cliente.sql no Supabase."
            );
        }
        throw erro;
    }

    // As sessões do Instagram ficam em arquivos: apaga as das contas excluídas.
    for (const contaId of resultado.contasExcluidas) {
        await desconectar(contaId).catch((erro) => {
            log.aviso(`Não foi possível apagar a sessão da conta ${contaId}`, formatarErro(erro));
        });
    }

    log.info("Cliente excluído", {
        clienteId: id,
        nome: cliente.nome,
        contas: resultado.contasExcluidas.length,
        usuarios: resultado.usuariosExcluidos
    });

    return {
        contasExcluidas: resultado.contasExcluidas.length,
        usuariosExcluidos: resultado.usuariosExcluidos
    };
}

module.exports = {
    listar,
    detalhar,
    criar,
    atualizar,
    excluir,
    adicionarUsuario,
    redefinirSenha,
    atualizarUsuario,
    contaComStatus
};
