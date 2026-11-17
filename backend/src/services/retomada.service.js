/**
 * Retomar publicações que não saíram no horário:
 *
 * 1. SEM RESPOSTA até o horário ("prazo esgotado": status `recusada` com
 *    `aprovacao` ainda `pendente`);
 * 2. ATRASADAS (status `atrasada`): aprovadas, mas o horário passou com o
 *    Publicador desligado. Só o administrador retoma; a aprovação não muda.
 *
 * Sem resposta:
 * Por até 30 dias depois do horário original, o cliente (ou a equipe, em
 * nome dele) pode:
 * - publicar agora: entra na fila do Publicador com o horário atual e sai
 *   em instantes; exige o perfil conectado (e, na Vercel, o Publicador
 *   ligado);
 * - agendar: escolhe qualquer horário que ainda não passou e a
 *   publicação já fica DEFERIDA, sem pedir nova aprovação.
 *
 * Fica registrado quem retomou (`retomada_por`, `retomada_pela_equipe`,
 * `retomada_em`) e o horário original (`horario_original`).
 */
const { ErroHttp } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const contasRepository = require("../repositories/contas.repository");
const contasService = require("./contas.service");
const agendador = require("./agendador.service");
const { exigirProntoParaPublicar } = require("./perfis.service");
const publicadorEstado = require("./publicador-estado.service");
const { config, MODOS } = require("../config/env");
const { PERFIS } = require("./auth.service");

const { STATUS, APROVACAO } = publicacoesRepository;
const log = criarLogger("Retomada");

/** Por quantos dias depois do horário original ainda dá para retomar. */
const DIAS_PARA_RETOMAR = 30;
const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * Tolerância para relógios diferentes entre o navegador e o servidor: um
 * horário escolhido "para o próximo minuto" pode chegar aqui alguns
 * segundos atrasado. Nesse caso o agendador publica na hora.
 */
const TOLERANCIA_RELOGIO_MS = 60 * 1000;

const ACOES = Object.freeze({ PUBLICAR: "publicar", AGENDAR: "agendar" });

/** Sem resposta até o horário (prazo esgotado). */
function semResposta(publicacao) {
    return (
        publicacao.status === STATUS.RECUSADA &&
        publicacao.aprovacao === APROVACAO.PENDENTE
    );
}

/** Horário perdido com o Publicador desligado. */
function atrasada(publicacao) {
    return publicacao.status === STATUS.ATRASADA;
}

/** Prazo esgotado e ainda dentro dos 30 dias. */
function podeRetomar(publicacao, agora = Date.now()) {
    return (
        semResposta(publicacao) &&
        new Date(publicacao.data_hora).getTime() >= agora - DIAS_PARA_RETOMAR * MS_DIA
    );
}

/**
 * Publicação que o autor pode retomar. Cliente: só dos próprios perfis
 * (outro cliente responde 404, igual a inexistente).
 */
async function buscarRetomavel(id, autor) {
    const publicacao = await publicacoesRepository.buscarPorId(id);
    if (!publicacao) throw new ErroHttp(404, "Publicação não encontrada.");

    if (autor.perfil !== PERFIS.ADMIN) {
        const conta = await contasRepository.buscarPorId(publicacao.conta_id);
        if (!conta || Number(conta.cliente_id) !== Number(autor.cliente?.id)) {
            throw new ErroHttp(404, "Publicação não encontrada.");
        }
    }

    if (atrasada(publicacao)) {
        if (autor.perfil !== PERFIS.ADMIN) throw new ErroHttp(404, "Publicação não encontrada.");
        return publicacao;
    }

    if (!semResposta(publicacao)) {
        throw new ErroHttp(409, "Só dá para publicar ou agendar posts que ficaram sem resposta ou atrasados.");
    }

    if (!podeRetomar(publicacao)) {
        throw new ErroHttp(409, `Este post ficou sem resposta há mais de ${DIAS_PARA_RETOMAR} dias e não pode mais ser usado.`);
    }

    return publicacao;
}

/** Valida o novo horário (ISO 8601, que ainda não passou, até 1 ano). */
function validarNovoHorario(valor) {
    const data = new Date(String(valor || ""));

    if (!valor || Number.isNaN(data.getTime())) {
        throw new ErroHttp(400, "Informe a data e o horário da publicação.");
    }
    if (data.getTime() < Date.now() - TOLERANCIA_RELOGIO_MS) {
        throw new ErroHttp(400, "Esse horário já passou. Escolha um horário a partir de agora.");
    }
    if (data.getTime() > Date.now() + 365 * MS_DIA) {
        throw new ErroHttp(400, "Escolha uma data dentro dos próximos 12 meses.");
    }

    return data;
}

/** Atualiza só se o status não mudou desde a leitura (evita publicar em dobro). */
async function gravar(id, campos, statusAtual) {
    let atualizada;
    try {
        atualizada = await publicacoesRepository.atualizarSeStatus(id, campos, [statusAtual]);
    } catch (erro) {
        if (/retomada|horario_original/.test(erro?.message || "")) {
            throw new ErroHttp(500, "Função indisponível: execute a migração 010 no Supabase.");
        }
        throw erro;
    }

    if (!atualizada) {
        throw new ErroHttp(409, "Este post já foi publicado ou agendado.");
    }

    return atualizada;
}

function camposDaRetomada(publicacao, autor, novoHorario) {
    const ehEquipe = autor.perfil === PERFIS.ADMIN;
    const agora = new Date().toISOString();

    // Atrasada já tinha sido aprovada (ou não precisava): a aprovação fica igual.
    if (atrasada(publicacao)) {
        return {
            retomada_por: autor.id ?? null,
            retomada_pela_equipe: true,
            retomada_em: agora,
            horario_original: publicacao.horario_original || publicacao.data_hora,
            data_hora: novoHorario.toISOString(),
            erro: null
        };
    }

    return {
        aprovacao: APROVACAO.DEFERIDA,
        aprovacao_por: autor.id,
        aprovacao_pela_equipe: ehEquipe,
        aprovacao_em: agora,
        aprovacao_categoria: null,
        aprovacao_motivo: null,
        retomada_por: autor.id,
        retomada_pela_equipe: ehEquipe,
        retomada_em: agora,
        horario_original: publicacao.horario_original || publicacao.data_hora,
        data_hora: novoHorario.toISOString(),
        erro: null
    };
}

/**
 * Publica agora um post sem resposta ou atrasado: entra na fila do
 * Publicador com o horário atual e sai em instantes (cerca de 1 minuto).
 *
 * @returns {Promise<object>} A publicação, agendada para agora.
 */
async function publicarAgora(id, autor) {
    const publicacao = await buscarRetomavel(id, autor);

    const conta = await contasService.buscarContaAtiva(publicacao.conta_id);
    if (!conta) throw new ErroHttp(400, "O perfil deste post não existe mais ou está inativo.");

    try {
        exigirProntoParaPublicar(conta);
    } catch (erro) {
        // A mensagem padrão fala com o administrador ("em Clientes").
        if (autor.perfil !== PERFIS.ADMIN && erro.status === 400) {
            throw new ErroHttp(
                400,
                `@${conta.username} não está conectado ao Instagram agora. ` +
                    "Conecte o perfil em \"Meus perfis\" (ou fale com a equipe) e tente de novo, ou use \"Agendar\"."
            );
        }
        throw erro;
    }

    if (config.modo === MODOS.API) await publicadorEstado.exigirOnline("publicar agora");

    const atualizada = await gravar(id, {
        ...camposDaRetomada(publicacao, autor, new Date()),
        status: STATUS.AGENDADA
    }, publicacao.status);

    log.info(`Publicação ${id} retomada: publicar agora`, { por: autor.id });
    agendador.agendar(atualizada);

    return atualizada;
}

/**
 * Agenda de novo um post sem resposta, já deferido.
 *
 * @param {string} dataHora - ISO 8601.
 * @returns {Promise<object>} A publicação agendada.
 */
async function agendarDeNovo(id, dataHora, autor) {
    const novoHorario = validarNovoHorario(dataHora);
    const publicacao = await buscarRetomavel(id, autor);

    const atualizada = await gravar(id, {
        ...camposDaRetomada(publicacao, autor, novoHorario),
        status: STATUS.AGENDADA
    }, publicacao.status);

    agendador.agendar(atualizada);
    log.info(`Publicação ${id} retomada: agendada`, { por: autor.id, dataHora: atualizada.data_hora });

    return atualizada;
}

/**
 * Entrada única das rotas: `{ acao: "publicar" }` ou
 * `{ acao: "agendar", dataHora }`.
 */
async function retomar(id, dados, autor) {
    const acao = String(dados?.acao || "");

    if (acao === ACOES.PUBLICAR) return publicarAgora(id, autor);
    if (acao === ACOES.AGENDAR) return agendarDeNovo(id, dados?.dataHora, autor);

    throw new ErroHttp(400, "Ação inválida: use publicar ou agendar.");
}

module.exports = {
    DIAS_PARA_RETOMAR,
    ACOES,
    semResposta,
    atrasada,
    podeRetomar,
    retomar,
    publicarAgora,
    agendarDeNovo
};
