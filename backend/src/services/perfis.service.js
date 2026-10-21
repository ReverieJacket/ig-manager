/**
 * Perfis do Instagram (tabela `contas_instagram`) vistos pelo administrador:
 * status da conexão, cadastro dentro de um cliente, renomear, remover e a
 * lista de perfis que precisam de atenção.
 *
 * Status de um perfil:
 * - "expirada":   o Instagram pediu login de novo ao publicar (reconectar);
 * - "conectado":  há sessão salva e ela não falhou;
 * - "aguardando": ainda não foi conectado.
 */
const { ErroHttp, formatarErro } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const clientesRepository = require("../repositories/clientes.repository");
const contasRepository = require("../repositories/contas.repository");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const { validarNovaConta } = require("./contas.service");
const { contaConectada, desconectar } = require("./instagram-auth.service");

const log = criarLogger("Perfis");

const STATUS_PERFIL = Object.freeze({
    EXPIRADA: "expirada",
    CONECTADO: "conectado",
    AGUARDANDO: "aguardando"
});

/**
 * @param {object} conta - Registro de `contas_instagram`.
 * @returns {("expirada"|"conectado"|"aguardando")}
 */
function statusDe(conta) {
    if (conta.sessao_expirada_em) return STATUS_PERFIL.EXPIRADA;
    return contaConectada(conta.id) ? STATUS_PERFIL.CONECTADO : STATUS_PERFIL.AGUARDANDO;
}

/** Formato do perfil para as telas. */
function perfilParaTela(conta) {
    const status = statusDe(conta);

    return {
        id: conta.id,
        nome: conta.nome,
        username: conta.username,
        ativo: conta.ativo,
        status,
        conectada: status === STATUS_PERFIL.CONECTADO,
        sessaoExpiradaEm: conta.sessao_expirada_em || null,
        cadastradaEm: conta.cadastrada_em || null,
        cadastradaPor: conta.autor?.nome || null,
        cliente: conta.clientes ? { id: conta.clientes.id, nome: conta.clientes.nome } : null
    };
}

/**
 * Todos os perfis ativos de clientes ativos, com o cliente de cada um.
 */
async function listar() {
    const contas = await contasRepository.listarAtivasComCliente();

    return contas
        .filter((c) => c.clientes && c.clientes.ativo !== false)
        .map(perfilParaTela);
}

/** Perfis com sessão expirada (contador do menu e aviso em Postagens). */
async function listarEmAtencao() {
    return (await listar()).filter((p) => p.status === STATUS_PERFIL.EXPIRADA);
}

async function buscarOu404(id) {
    const conta = await contasRepository.buscarPorId(id);
    if (!conta) throw new ErroHttp(404, "Perfil não encontrado.");
    return conta;
}

/**
 * O administrador adiciona um perfil a um cliente.
 *
 * @param {number} clienteId
 * @param {{id: number}} admin - Usuário da sessão (autor do cadastro).
 * @param {{nome: string, username: string}} dados
 */
async function adicionar(clienteId, admin, dados) {
    const cliente = await clientesRepository.buscarPorId(clienteId);
    if (!cliente) throw new ErroHttp(404, "Cliente não encontrado.");
    if (!cliente.ativo) throw new ErroHttp(400, "Reative o cliente antes de adicionar perfis.");

    const { nome, username } = await validarNovaConta(dados);

    const conta = await contasRepository.criar({
        cliente: cliente.nome,
        clienteId: cliente.id,
        cadastradaPor: admin.id,
        nome,
        username
    });

    log.info("Perfil adicionado pelo administrador", { clienteId, contaId: conta.id });

    return perfilParaTela(conta);
}

/** Altera o nome exibido do perfil (o @ não muda). */
async function renomear(id, nome) {
    await buscarOu404(id);

    const limpo = String(nome ?? "").trim();
    if (!limpo || limpo.length > 120) {
        throw new ErroHttp(400, "Informe um nome com até 120 caracteres.");
    }

    return perfilParaTela(await contasRepository.atualizar(id, { nome: limpo }));
}

/**
 * Remove o perfil de vez, junto com a sessão salva do Instagram.
 * Bloqueado se o perfil já tiver publicações (preserva o histórico).
 */
async function remover(id) {
    const conta = await buscarOu404(id);

    if (await publicacoesRepository.existeParaConta(id)) {
        throw new ErroHttp(
            409,
            `@${conta.username} já tem publicações e não pode ser removido, para não perder o histórico.`
        );
    }

    await desconectar(id).catch((erro) => {
        log.aviso(`Não foi possível apagar a sessão do perfil ${id}`, formatarErro(erro));
    });
    await contasRepository.excluir(id);

    log.info("Perfil removido", { contaId: id, username: conta.username });
}

/**
 * Confere se dá para publicar AGORA no perfil (antes de abrir o navegador).
 *
 * @throws {ErroHttp} 400 com a explicação para o administrador.
 */
function exigirProntoParaPublicar(conta) {
    const status = statusDe(conta);

    if (status === STATUS_PERFIL.EXPIRADA) {
        throw new ErroHttp(400, `A sessão de @${conta.username} expirou. Reconecte o perfil em Clientes antes de publicar.`);
    }
    if (status === STATUS_PERFIL.AGUARDANDO) {
        throw new ErroHttp(400, `@${conta.username} ainda não foi conectado. Conecte o perfil em Clientes antes de publicar.`);
    }
}

module.exports = {
    STATUS_PERFIL,
    statusDe,
    perfilParaTela,
    listar,
    listarEmAtencao,
    adicionar,
    renomear,
    remover,
    exigirProntoParaPublicar
};
