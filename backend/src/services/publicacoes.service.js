/**
 * Serviço de publicações: regras de negócio da API.
 *
 * Orquestra repositórios, agendador e publicador. As rotas só chamam
 * estas funções; não falam direto com o banco.
 */
const path = require("path");

const { ErroHttp } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const contasRepository = require("../repositories/contas.repository");
const contasService = require("./contas.service");
const agendador = require("./agendador.service");
const { executarPublicacao } = require("./publicador.service");
const { exigirProntoParaPublicar } = require("./perfis.service");
const { comAutorDaResposta } = require("./aprovacoes.service");

const { STATUS, APROVACAO } = publicacoesRepository;
const log = criarLogger("Publicacoes");

/**
 * Completa publicações com nome/username da conta e URL pública da imagem.
 *
 * @param {object[]} publicacoes
 * @returns {Promise<object[]>}
 */
async function completarComConta(publicacoes) {
    if (publicacoes.length === 0) return [];

    const idsContas = [...new Set(publicacoes.map((p) => p.conta_id))];
    const contas = await contasRepository.buscarPorIds(idsContas);
    const contasPorId = new Map(contas.map((conta) => [conta.id, conta]));

    return publicacoes.map((publicacao) => {
        const conta = contasPorId.get(publicacao.conta_id);

        return {
            ...publicacao,
            conta: conta?.nome || "",
            username: conta?.username || "",
            cliente_id: conta?.cliente_id ?? null,
            cliente: conta?.clientes?.nome || "",
            imagem: publicacao.imagem
                ? `/uploads/${encodeURIComponent(path.basename(publicacao.imagem))}`
                : null
        };
    });
}

/**
 * Lista as publicações já com nome/username da conta e URL pública da imagem.
 *
 * @returns {Promise<object[]>}
 */
async function listarPublicacoes() {
    return comAutorDaResposta(await completarComConta(await publicacoesRepository.listar()));
}

/** Status que o cliente enxerga (erros técnicos ficam só para o admin). */
const STATUS_VISIVEIS_AO_CLIENTE = [STATUS.AGENDADA, STATUS.PUBLICANDO, STATUS.PUBLICADA];

/**
 * Publicações das contas de um cliente (área do cliente): programadas,
 * em andamento e publicadas. Sem o campo `erro`, que é técnico.
 *
 * @param {number} clienteId - SEMPRE vindo da sessão.
 * @returns {Promise<object[]>}
 */
async function listarPublicacoesDoCliente(clienteId) {
    const contas = await contasRepository.listarPorCliente(clienteId);
    const publicacoes = await publicacoesRepository.listarPorContas(
        contas.map((c) => c.id),
        STATUS_VISIVEIS_AO_CLIENTE
    );

    return (await completarComConta(publicacoes)).map(({ erro, ...resto }) => resto);
}

/**
 * Busca uma publicação pelo id.
 *
 * @param {number} id
 * @returns {Promise<object>}
 * @throws {ErroHttp} 404 se não existir.
 */
async function buscarPublicacao(id) {
    const publicacao = await publicacoesRepository.buscarPorId(id);

    if (!publicacao) {
        throw new ErroHttp(404, "Publicação não encontrada.");
    }

    return publicacao;
}

/**
 * Cria uma publicação. Se a data for futura, apenas agenda; caso
 * contrário, publica imediatamente e aguarda o resultado.
 *
 * @param {{arquivo: Express.Multer.File, texto: string,
 *          contaId: number, dataHora: Date}} entrada - Dados já validados.
 * @returns {Promise<{agendada: boolean, publicacao: object,
 *                    resultado?: object}>}
 * @throws {ErroHttp} 400 se a conta não existir ou estiver inativa.
 */
async function criarPublicacao({ arquivo, texto, contaId, dataHora }) {
    const conta = await contasService.buscarContaAtiva(contaId);

    if (!conta) {
        throw new ErroHttp(
            400,
            "A conta selecionada não existe ou está inativa."
        );
    }

    const agendada = dataHora.getTime() > Date.now();

    // Publicar agora num perfil desconectado/expirado só geraria erro.
    // Agendar continua permitido: dá tempo de conectar antes do horário.
    if (!agendada) exigirProntoParaPublicar(conta);

    log.info("Registrando nova publicação", {
        contaId,
        username: conta.username,
        dataHora: dataHora.toISOString(),
        agendada
    });

    let publicacao;
    try {
        publicacao = await publicacoesRepository.criar({
            conta_id: contaId,
            imagem: arquivo.filename,
            texto,
            data_hora: dataHora.toISOString(),
            status: agendada ? STATUS.AGENDADA : STATUS.PUBLICANDO,
            // Agendada passa pela aprovação do cliente; publicar agora, não.
            ...(agendada ? { aprovacao: APROVACAO.PENDENTE } : {}),
            erro: null
        });
    } catch (erro) {
        if (/aprovacao/.test(erro?.message || "")) {
            throw new ErroHttp(500, "Aprovações indisponíveis: execute a migração 008 no Supabase.");
        }
        throw erro;
    }

    log.info(`Publicação registrada: ${publicacao.id}`);

    if (agendada) {
        agendador.agendar(publicacao);
        return { agendada: true, publicacao };
    }

    const resultado = await executarPublicacao(publicacao);

    return { agendada: false, publicacao, resultado };
}

/** Status que o administrador pode cancelar. */
const STATUS_CANCELAVEIS = [STATUS.AGENDADA, STATUS.RECUSADA];

/**
 * Cancela uma publicação agendada (ou recusada). Não apaga: o status vira
 * `cancelada`, com quem e quando, e o agendamento é desfeito.
 *
 * @param {number} id
 * @param {{id: number}} admin - Usuário da sessão.
 * @returns {Promise<object>} A publicação atualizada.
 */
async function cancelarPublicacao(id, admin) {
    const publicacao = await buscarPublicacao(id);

    if (publicacao.status === STATUS.CANCELADA) {
        throw new ErroHttp(409, "Esta publicação já foi cancelada.");
    }

    if (!STATUS_CANCELAVEIS.includes(publicacao.status)) {
        throw new ErroHttp(409, "Só dá para cancelar publicações agendadas que ainda não saíram.");
    }

    let atualizada;
    try {
        atualizada = await publicacoesRepository.atualizarSeStatus(
            id,
            {
                status: STATUS.CANCELADA,
                cancelada_por: admin.id,
                cancelada_em: new Date().toISOString()
            },
            STATUS_CANCELAVEIS
        );
    } catch (erro) {
        if (/cancelada|check constraint|violates/i.test(erro?.message || "")) {
            throw new ErroHttp(500, "Cancelamento indisponível: execute a migração 009 no Supabase.");
        }
        throw erro;
    }

    if (!atualizada) {
        throw new ErroHttp(409, "A publicação acabou de começar a sair e não pode mais ser cancelada.");
    }

    agendador.cancelar(id);
    log.info(`Publicação ${id} cancelada`, { por: admin.id });

    return atualizada;
}

module.exports = {
    cancelarPublicacao,
    completarComConta,
    listarPublicacoes,
    listarPublicacoesDoCliente,
    buscarPublicacao,
    criarPublicacao
};
