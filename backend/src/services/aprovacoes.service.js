/**
 * Aprovação das publicações agendadas (etapa 3).
 *
 * Regras:
 * - Publicação AGENDADA nasce com `aprovacao = "pendente"`; publicar agora
 *   não passa por aprovação (`aprovacao` nula).
 * - Sem resposta até o horário, publica (o agendador só pula as recusadas).
 * - Indeferida não é publicada: o status vira `recusada` e o timer é
 *   cancelado. Não existe "ajustar e reenviar": a equipe cria outra.
 * - O cliente pode mudar a resposta até o horário; deferir uma recusada
 *   volta o status para `agendada` e reagenda.
 * - A equipe (administrador) pode responder em nome do cliente; fica
 *   registrado em `aprovacao_pela_equipe`.
 * - O cliente só responde publicações dos próprios perfis.
 */
const { ErroHttp } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const contasRepository = require("../repositories/contas.repository");
const usuariosRepository = require("../repositories/usuarios.repository");
const agendador = require("./agendador.service");
const { PERFIS } = require("./auth.service");

const { STATUS, APROVACAO } = publicacoesRepository;
const log = criarLogger("Aprovacoes");

/** Motivos de indeferimento (chips da tela). */
const CATEGORIAS = Object.freeze({
    texto: "Texto / informação errada",
    imagem: "Imagem",
    data: "Data / horário",
    nao_quero: "Não quero este post"
});

const MOTIVO_MIN = 10;
const MOTIVO_MAX = 500;
const LOTE_MAX = 50;

/** Respondidas que continuam aparecendo depois do horário (dias). */
const DIAS_HISTORICO = 7;

/** Status em que a resposta ainda pode mudar. */
const STATUS_MUTAVEIS = [STATUS.AGENDADA, STATUS.RECUSADA];

/* ------------------------------- validação ------------------------------- */

/**
 * @param {{decisao: string, categoria?: string, motivo?: string}} dados
 * @returns {{decisao: string, categoria: (string|null), motivo: (string|null)}}
 */
function validarResposta(dados) {
    const decisao = String(dados?.decisao || "");

    if (decisao === APROVACAO.DEFERIDA) {
        return { decisao, categoria: null, motivo: null };
    }

    if (decisao !== APROVACAO.INDEFERIDA) {
        throw new ErroHttp(400, "Resposta inválida: use deferida ou indeferida.");
    }

    const categoria = String(dados?.categoria || "");
    if (!Object.hasOwn(CATEGORIAS, categoria)) {
        throw new ErroHttp(400, "Escolha o motivo do indeferimento.");
    }

    const motivo = String(dados?.motivo || "").trim();
    if (motivo.length < MOTIVO_MIN) {
        throw new ErroHttp(400, `Explique o motivo com pelo menos ${MOTIVO_MIN} caracteres.`);
    }
    if (motivo.length > MOTIVO_MAX) {
        throw new ErroHttp(400, `O motivo deve ter até ${MOTIVO_MAX} caracteres.`);
    }

    return { decisao, categoria, motivo };
}

/* -------------------------------- resposta -------------------------------- */

/**
 * Registra a resposta de uma publicação.
 *
 * @param {number} publicacaoId
 * @param {{decisao: string, categoria?: string, motivo?: string}} dados
 * @param {{id: number, perfil: string, cliente?: {id: number}}} autor -
 *   Usuário da sessão. Cliente: só os próprios perfis.
 * @returns {Promise<object>} A publicação atualizada.
 */
async function responder(publicacaoId, dados, autor) {
    const resposta = validarResposta(dados);
    const ehEquipe = autor.perfil === PERFIS.ADMIN;

    const publicacao = await publicacoesRepository.buscarPorId(publicacaoId);
    if (!publicacao) throw new ErroHttp(404, "Publicação não encontrada.");

    if (!ehEquipe) {
        const conta = await contasRepository.buscarPorId(publicacao.conta_id);
        if (!conta || Number(conta.cliente_id) !== Number(autor.cliente?.id)) {
            // Igual a inexistente: não revela publicações de outros clientes.
            throw new ErroHttp(404, "Publicação não encontrada.");
        }
    }

    if (!publicacao.aprovacao) {
        throw new ErroHttp(400, "Esta publicação não passa por aprovação.");
    }

    if (publicacao.status === STATUS.CANCELADA) {
        throw new ErroHttp(409, "Esta publicação foi cancelada pela equipe.");
    }

    if (!STATUS_MUTAVEIS.includes(publicacao.status)) {
        throw new ErroHttp(409, "Esta publicação já saiu (ou está saindo) e não pode mais ser alterada.");
    }

    if (new Date(publicacao.data_hora).getTime() <= Date.now()) {
        throw new ErroHttp(409, "O horário desta publicação já passou; não dá mais para mudar a resposta.");
    }

    const indeferida = resposta.decisao === APROVACAO.INDEFERIDA;

    const atualizada = await publicacoesRepository.atualizarSeStatus(
        publicacaoId,
        {
            aprovacao: resposta.decisao,
            aprovacao_por: autor.id,
            aprovacao_pela_equipe: ehEquipe,
            aprovacao_em: new Date().toISOString(),
            aprovacao_categoria: resposta.categoria,
            aprovacao_motivo: resposta.motivo,
            status: indeferida ? STATUS.RECUSADA : STATUS.AGENDADA
        },
        STATUS_MUTAVEIS
    );

    if (!atualizada) {
        throw new ErroHttp(409, "Esta publicação acabou de começar a sair e não pode mais ser alterada.");
    }

    if (indeferida) {
        agendador.cancelar(publicacaoId);
    } else if (publicacao.status === STATUS.RECUSADA) {
        // Mudou de ideia: volta para a fila no horário original.
        agendador.agendar(atualizada);
    }

    log.info(`Publicação ${publicacaoId} ${resposta.decisao}`, {
        por: autor.id,
        pelaEquipe: ehEquipe
    });

    return atualizada;
}

/**
 * Defere várias publicações do cliente de uma vez ("Deferir selecionadas").
 * Cada uma é tratada isoladamente: uma falha não impede as outras.
 *
 * @returns {Promise<{deferidas: number[], falhas: {id: number, mensagem: string}[]}>}
 */
async function deferirLote(ids, autor) {
    if (!Array.isArray(ids) || ids.length === 0) {
        throw new ErroHttp(400, "Selecione pelo menos uma publicação.");
    }
    if (ids.length > LOTE_MAX) {
        throw new ErroHttp(400, `Selecione no máximo ${LOTE_MAX} publicações por vez.`);
    }

    const unicos = [...new Set(ids.map(Number))];
    if (unicos.some((id) => !Number.isInteger(id) || id <= 0)) {
        throw new ErroHttp(400, "Seleção inválida.");
    }

    const deferidas = [];
    const falhas = [];

    for (const id of unicos) {
        try {
            await responder(id, { decisao: APROVACAO.DEFERIDA }, autor);
            deferidas.push(id);
        } catch (erro) {
            falhas.push({ id, mensagem: erro.message });
        }
    }

    return { deferidas, falhas };
}

/* --------------------------------- leitura -------------------------------- */

/**
 * Acrescenta os nomes de quem respondeu (`aprovacao_por_nome`) e de quem
 * cancelou (`cancelada_por_nome`).
 *
 * @param {object[]} publicacoes
 */
async function comAutorDaResposta(publicacoes) {
    const ids = [
        ...new Set(publicacoes.flatMap((p) => [p.aprovacao_por, p.cancelada_por]).filter(Boolean))
    ];
    const nomes = new Map(
        (await usuariosRepository.buscarNomesPorIds(ids)).map((u) => [u.id, u.nome])
    );

    return publicacoes.map((p) => ({
        ...p,
        aprovacao_por_nome: p.aprovacao_por ? nomes.get(p.aprovacao_por) || null : null,
        cancelada_por_nome: p.cancelada_por ? nomes.get(p.cancelada_por) || null : null
    }));
}

/** Data usada para ordenar as respondidas (resposta ou cancelamento). */
function dataResposta(p) {
    return p.status === STATUS.CANCELADA ? p.cancelada_em || p.aprovacao_em : p.aprovacao_em;
}

/**
 * Tela Aprovações do cliente.
 *
 * - `pendentes`: agendadas sem resposta, com horário no futuro.
 * - `respondidas`: deferidas/indeferidas (e canceladas pela equipe) dos
 *   últimos dias e futuras; `podeMudar` indica se ainda dá para trocar a
 *   resposta.
 *
 * @param {number} clienteId - SEMPRE da sessão.
 * @param {(publicacoes: object[]) => Promise<object[]>} completar -
 *   Acrescenta perfil e URL da imagem (de `publicacoes.service`).
 */
async function listarDoCliente(clienteId, completar) {
    const contas = await contasRepository.listarPorCliente(clienteId);
    const desde = new Date(Date.now() - DIAS_HISTORICO * 24 * 60 * 60 * 1000).toISOString();

    const brutas = await publicacoesRepository.listarComAprovacao(
        contas.filter((c) => c.ativo).map((c) => c.id),
        desde
    );

    const agora = Date.now();
    const lista = (await comAutorDaResposta(await completar(brutas))).map(
        ({ erro, aprovacao_por, cancelada_por, ...p }) => ({
            ...p,
            podeMudar:
                STATUS_MUTAVEIS.includes(p.status) && new Date(p.data_hora).getTime() > agora
        })
    );

    return {
        pendentes: lista.filter((p) => p.aprovacao === APROVACAO.PENDENTE && p.podeMudar),
        // Canceladas pela equipe também aparecem aqui (sem opção de mudar).
        respondidas: lista
            .filter((p) => p.aprovacao !== APROVACAO.PENDENTE || p.status === STATUS.CANCELADA)
            .sort((a, b) => new Date(dataResposta(b)) - new Date(dataResposta(a)))
    };
}

module.exports = {
    CATEGORIAS,
    validarResposta,
    responder,
    deferirLote,
    comAutorDaResposta,
    listarDoCliente
};
