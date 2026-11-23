/**
 * O lado do servidor do Publicador: tudo o que ele precisa ler e gravar
 * no banco, sem abrir navegador.
 *
 * Usado de dois jeitos, com as mesmas regras:
 * - direto, quando o Publicador roda junto com o banco (backend completo,
 *   `npm run publicador`) — `publicador/porta-local.js`;
 * - pelas rotas `/publicador/*` do site, quando o Publicador é o app
 *   instalado, que só tem o login do administrador — `porta-remota.js`.
 */
const os = require("os");

const { ErroHttp } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const { formatarErro } = require("../lib/erros");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const contasRepository = require("../repositories/contas.repository");
const tarefasRepository = require("../repositories/tarefas.repository");
const publicadorRepository = require("../repositories/publicador.repository");
const publicadorService = require("./publicador.service");
const contasService = require("./contas.service");

const { STATUS, APROVACAO } = publicacoesRepository;
const { TIPOS } = tarefasRepository;
const log = criarLogger("Publicador");

/** Margem para o horário "na hora": até 1 min antes de acordar ainda publica. */
const TOLERANCIA_MS = 60 * 1000;

const MENSAGEM_PRAZO_ESGOTADO =
    "Não publicada: o cliente não respondeu à aprovação até o horário.";

/** @username e cliente, para as janelas do app. */
async function completar(lista) {
    if (!lista.length) return lista;
    try {
        const { completarComConta } = require("./publicacoes.service");
        return await completarComConta(lista);
    } catch {
        return lista;
    }
}

/* -------------------------------- início --------------------------------- */

/**
 * O Publicador ligou: grava o sinal e organiza o que ficou para trás
 * (publicações e pedidos interrompidos viram erro).
 *
 * @param {{maquina?: string, versao?: string}} dados
 * @returns {Promise<{interrompidas: number}>}
 */
async function iniciar({ maquina = os.hostname(), versao = "" } = {}) {
    await sinalizar({ iniciado_em: new Date().toISOString(), maquina, versao });

    let interrompidas = 0;
    try {
        const lista = await publicacoesRepository.listarPorStatus(STATUS.PUBLICANDO);
        for (const publicacao of lista) {
            await publicacoesRepository.atualizar(publicacao.id, {
                status: STATUS.ERRO,
                erro:
                    "Resultado incerto: o Publicador foi fechado durante a publicação. " +
                    "Confira no Instagram antes de publicar de novo."
            });
            interrompidas++;
        }
    } catch (erro) {
        log.erro("Não foi possível conferir publicações interrompidas", formatarErro(erro));
    }

    await tarefasRepository.encerrarInterrompidas().catch(() => 0);

    return { interrompidas };
}

async function sinalizar(extra = {}) {
    try {
        await publicadorRepository.sinalizar(extra);
    } catch (erro) {
        log.aviso("Não foi possível gravar o sinal do Publicador (execute a migração 011)", formatarErro(erro));
    }
}

async function desligar() {
    await publicadorRepository.desligar().catch(() => {});
}

/* ------------------------------ publicações ------------------------------ */

/** Agendadas cujo horário chegou (só id e horário). */
async function vencidas() {
    const lista = await publicacoesRepository.listarVencidas(new Date().toISOString());
    return lista.map((p) => ({ id: p.id, data_hora: p.data_hora }));
}

/**
 * Decide o que fazer com uma agendada vencida (relida agora: o cliente pode
 * ter respondido há pouco) e, se for publicar, a reserva para este
 * Publicador (agendada → publicando, só um consegue).
 *
 * @param {number} id
 * @param {number} acordadoDesde - Desde quando o Publicador está ligado
 *   sem interrupção (ms). O que venceu antes disso fica atrasado.
 * @returns {Promise<{acao: "publicar"|"atrasada"|"nada", publicacao?: object,
 *   conta?: object}>}
 */
async function tratar(id, acordadoDesde) {
    const atual = await publicacoesRepository.buscarPorId(Number(id));
    if (!atual || atual.status !== STATUS.AGENDADA) return { acao: "nada" };

    if (atual.aprovacao === APROVACAO.PENDENTE) {
        const marcada = await publicacoesRepository.atualizarSeStatus(
            atual.id,
            { status: STATUS.RECUSADA, erro: MENSAGEM_PRAZO_ESGOTADO },
            [STATUS.AGENDADA]
        );
        if (marcada) log.info(`Publicação ${atual.id} não publicada: o cliente não respondeu até o horário.`);
        return { acao: "nada" };
    }

    if (atual.aprovacao === APROVACAO.INDEFERIDA) return { acao: "nada" };

    if (new Date(atual.data_hora).getTime() < Number(acordadoDesde) - TOLERANCIA_MS) {
        const horario = new Date(atual.data_hora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const marcada = await publicacoesRepository.atualizarSeStatus(
            atual.id,
            {
                status: STATUS.ATRASADA,
                erro: `Horário perdido: o Publicador estava desligado em ${horario}. Publique agora ou reagende.`
            },
            [STATUS.AGENDADA]
        );
        if (marcada) log.aviso(`Publicação ${atual.id} ficou atrasada`, { horario: atual.data_hora });
        return { acao: marcada ? "atrasada" : "nada" };
    }

    const reservada = await publicacoesRepository.atualizarSeStatus(
        atual.id,
        { status: STATUS.PUBLICANDO, erro: null },
        [STATUS.AGENDADA]
    );
    if (!reservada) return { acao: "nada" };

    log.info(`Iniciando publicação ${reservada.id}`);

    const conta = await contasService.buscarContaAtiva(reservada.conta_id);
    if (!conta) {
        await publicadorService.registrarResultado(reservada.id, null, {
            sucesso: false,
            mensagem: "A conta vinculada não existe ou está inativa."
        });
        return { acao: "nada" };
    }

    return {
        acao: "publicar",
        publicacao: {
            id: reservada.id,
            imagem: reservada.imagem,
            texto: reservada.texto,
            mimetype: reservada.mimetype || null
        },
        conta: { id: conta.id, username: conta.username }
    };
}

/**
 * Grava o resultado que o Publicador trouxe do Instagram.
 *
 * @param {number} id
 * @param {object} resultado - `{ sucesso, incerto, mensagem, codigoPost, sessaoInvalida }`.
 */
async function registrarResultado(id, resultado) {
    const publicacao = await publicacoesRepository.buscarPorId(Number(id));
    if (!publicacao) throw new ErroHttp(404, "Publicação não encontrada.");
    if (publicacao.status !== STATUS.PUBLICANDO) {
        throw new ErroHttp(409, "Esta publicação não está em andamento.");
    }

    const conta = await contasRepository.buscarPorId(publicacao.conta_id).catch(() => null);

    return publicadorService.registrarResultado(publicacao.id, conta, {
        sucesso: Boolean(resultado?.sucesso),
        incerto: Boolean(resultado?.incerto),
        mensagem: typeof resultado?.mensagem === "string" ? resultado.mensagem.slice(0, 2000) : undefined,
        codigoPost: typeof resultado?.codigoPost === "string" ? resultado.codigoPost.slice(0, 100) : undefined,
        sessaoInvalida: Boolean(resultado?.sessaoInvalida)
    });
}

/** Link temporário da imagem de uma publicação em andamento. */
async function linkDaImagem(id) {
    const publicacao = await publicacoesRepository.buscarPorId(Number(id));
    if (!publicacao) throw new ErroHttp(404, "Publicação não encontrada.");

    const { linkTemporario } = require("../lib/imagens");
    const link = await linkTemporario(publicacao.imagem);
    if (!link) throw new ErroHttp(404, "Imagem não encontrada no Supabase Storage.");

    return { nome: publicacao.imagem, link };
}

async function atrasadas() {
    return completar(await publicacoesRepository.listarPorStatus(STATUS.ATRASADA));
}

/** Agendadas que ainda vão sair (alerta antes de desligar). */
async function proximas() {
    const lista = await publicacoesRepository.listarProximas(new Date().toISOString());
    return completar(lista.filter((p) => p.aprovacao !== APROVACAO.INDEFERIDA));
}

/* -------------------------------- tarefas -------------------------------- */

async function tarefasPendentes() {
    return tarefasRepository.listarPendentes();
}

/**
 * Pega um pedido (só um Publicador consegue) e junta o que ele precisa:
 * o perfil (conectar/desconectar) ou a publicação (coletar comentários).
 *
 * @returns {Promise<{tarefa: object, conta?: object, publicacao?: object}|null>}
 */
async function pegarTarefa(id) {
    const tarefa = await tarefasRepository.pegar(Number(id));
    if (!tarefa) return null;

    const extra = {};
    if (tarefa.conta_id) {
        const conta = await contasRepository.buscarPorId(tarefa.conta_id).catch(() => null);
        if (conta) extra.conta = { id: conta.id, username: conta.username, ativo: conta.ativo };
    }
    if (tarefa.tipo === TIPOS.COLETAR_COMENTARIOS && tarefa.publicacao_id) {
        const p = await publicacoesRepository.buscarPorId(tarefa.publicacao_id);
        if (p) extra.publicacao = { id: p.id, conta_id: p.conta_id, ig_codigo: p.ig_codigo, status: p.status };
    }

    return { tarefa, ...extra };
}

async function informarTarefa(id, mensagem) {
    await tarefasRepository.informar(Number(id), String(mensagem || "").slice(0, 500));
}

async function concluirTarefa(id, fim) {
    await tarefasRepository.concluir(Number(id), {
        sucesso: Boolean(fim?.sucesso),
        mensagem: fim?.mensagem ? String(fim.mensagem).slice(0, 2000) : null,
        resultado: fim?.resultado ?? null
    });
}

/* --------------------------------- perfis -------------------------------- */

async function contasAtivas() {
    const lista = await contasRepository.listarAtivas();
    return lista.map((c) => ({ id: c.id, username: c.username, sessao_salva_em: c.sessao_salva_em || null }));
}

/** Perfil para conectar (só ativos). */
async function contaParaConectar(id) {
    const conta = await contasService.buscarContaAtiva(Number(id));
    return conta ? { id: conta.id, username: conta.username } : null;
}

/**
 * O Publicador salvou (`quando`) ou apagou (`null`) a sessão de um perfil.
 * Sessão salva também tira o aviso de "Sessão expirada".
 */
async function definirSessao(id, quando) {
    const n = Number(id);
    if (quando) await contasRepository.limparSessaoExpirada(n).catch(() => {});
    await contasRepository.definirSessaoSalva(n, quando || null);
}

/* ------------------------------- comentários ----------------------------- */

async function salvarComentarios(publicacaoId, coleta) {
    const publicacao = await publicacoesRepository.buscarPorId(Number(publicacaoId));
    if (!publicacao) throw new ErroHttp(404, "Publicação não encontrada.");

    const { sincronizarColeta } = require("./comentarios.service");
    return sincronizarColeta(publicacao, coleta);
}

module.exports = {
    iniciar,
    sinalizar,
    desligar,
    vencidas,
    tratar,
    registrarResultado,
    linkDaImagem,
    atrasadas,
    proximas,
    tarefasPendentes,
    pegarTarefa,
    informarTarefa,
    concluirTarefa,
    contasAtivas,
    contaParaConectar,
    definirSessao,
    salvarComentarios,
    MENSAGEM_PRAZO_ESGOTADO
};
