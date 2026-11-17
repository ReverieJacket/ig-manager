/**
 * Publicador: o "trabalhador" que fala com o Instagram.
 *
 * Roda no computador do administrador (app Publicador, ou dentro do
 * backend no modo "completo"). Em vez de timers, consulta o banco:
 * - a cada 15 s: publica as agendadas cujo horário chegou;
 * - a cada 4 s: executa os pedidos do site (conectar, desconectar,
 *   coletar comentários);
 * - a cada 30 s: grava o "sinal de vida" que o site usa para mostrar se o
 *   Publicador está ligado.
 *
 * Horário perdido: o que venceu enquanto o Publicador estava desligado (ou
 * o computador dormindo) NÃO sai sozinho. Aprovado (ou sem aprovação) vira
 * `atrasada` e o administrador escolhe "Publicar agora" ou "Reagendar";
 * sem resposta do cliente continua sendo "prazo esgotado" (`recusada`).
 */
const EventEmitter = require("events");
const fs = require("fs");
const os = require("os");

const { config } = require("../config/env");
const { criarLogger } = require("../lib/logger");
const { formatarErro } = require("../lib/erros");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const contasRepository = require("../repositories/contas.repository");
const tarefasRepository = require("../repositories/tarefas.repository");
const publicadorRepository = require("../repositories/publicador.repository");

const { STATUS, APROVACAO } = publicacoesRepository;
const { TIPOS } = tarefasRepository;
const log = criarLogger("Publicador");

/** Margem para o horário "na hora": até 1 min antes de acordar ainda publica. */
const TOLERANCIA_MS = 60 * 1000;
/** Tempo máximo esperando o login de uma conexão. */
const LIMITE_CONEXAO_MS = 10 * 60 * 1000;

const MENSAGEM_PRAZO_ESGOTADO =
    "Não publicada: o cliente não respondeu à aprovação até o horário.";

const eventos = new EventEmitter();

const estado = {
    ativo: false,
    /** Desde quando o Publicador está ligado sem interrupção (nem sono). */
    acordadoDesde: 0,
    ultimoCicloPublicacoes: 0,
    publicando: false,
    repetirPublicacoes: false,
    lendoTarefas: false,
    timers: [],
    tarefasEmAndamento: new Set()
};

/* ------------------------------ Publicações ------------------------------ */

/** Sem resposta até o horário: vira `recusada` (prazo esgotado). */
async function marcarPrazoEsgotado(id) {
    const atualizada = await publicacoesRepository.atualizarSeStatus(
        id,
        { status: STATUS.RECUSADA, erro: MENSAGEM_PRAZO_ESGOTADO },
        [STATUS.AGENDADA]
    );
    if (atualizada) log.info(`Publicação ${id} não publicada: o cliente não respondeu até o horário.`);
}

/** Horário perdido com o Publicador desligado: vira `atrasada`. */
async function marcarAtrasada(publicacao) {
    const horario = new Date(publicacao.data_hora).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const atualizada = await publicacoesRepository.atualizarSeStatus(
        publicacao.id,
        {
            status: STATUS.ATRASADA,
            erro: `Horário perdido: o Publicador estava desligado em ${horario}. Publique agora ou reagende.`
        },
        [STATUS.AGENDADA]
    );
    if (atualizada) log.aviso(`Publicação ${publicacao.id} ficou atrasada`, { horario: publicacao.data_hora });
    return atualizada;
}

/**
 * Decide o que fazer com uma agendada vencida (relida do banco: o cliente
 * pode ter respondido há pouco).
 *
 * @returns {Promise<"publicada"|"atrasada"|"ignorada">}
 */
async function tratarVencida(publicacao) {
    const atual = await publicacoesRepository.buscarPorId(publicacao.id);
    if (!atual || atual.status !== STATUS.AGENDADA) return "ignorada";

    if (atual.aprovacao === APROVACAO.PENDENTE) {
        await marcarPrazoEsgotado(atual.id);
        return "ignorada";
    }

    if (atual.aprovacao === APROVACAO.INDEFERIDA) return "ignorada";

    const venceuDormindo = new Date(atual.data_hora).getTime() < estado.acordadoDesde - TOLERANCIA_MS;

    if (venceuDormindo) {
        return (await marcarAtrasada(atual)) ? "atrasada" : "ignorada";
    }

    // Reserva: só um Publicador consegue passar de agendada para publicando.
    const reservada = await publicacoesRepository.atualizarSeStatus(
        atual.id,
        { status: STATUS.PUBLICANDO, erro: null },
        [STATUS.AGENDADA]
    );
    if (!reservada) return "ignorada";

    // Carregado só aqui: o site (Vercel) nunca precisa do Playwright.
    const { executarPublicacao } = require("../services/publicador.service");
    const resultado = await executarPublicacao(reservada);

    eventos.emit("publicacao", { id: reservada.id, ...resultado });

    return "publicada";
}

/** Uma rodada: tudo o que venceu até agora. */
async function cicloPublicacoes() {
    if (estado.publicando) {
        estado.repetirPublicacoes = true;
        return;
    }

    estado.publicando = true;

    try {
        do {
            estado.repetirPublicacoes = false;
            detectarSono();

            const vencidas = await publicacoesRepository.listarVencidas(new Date().toISOString());
            let atrasadas = 0;

            for (const publicacao of vencidas) {
                if (!estado.ativo) return;
                try {
                    if ((await tratarVencida(publicacao)) === "atrasada") atrasadas++;
                } catch (erro) {
                    log.erro(`Erro ao tratar a publicação ${publicacao.id}`, formatarErro(erro));
                }
            }

            if (atrasadas > 0) await avisarAtrasadas();
            estado.ultimoCicloPublicacoes = Date.now();
        } while (estado.repetirPublicacoes && estado.ativo);
    } catch (erro) {
        log.erro("Falha ao consultar as publicações agendadas", formatarErro(erro));
    } finally {
        estado.publicando = false;
    }
}

/**
 * Se o intervalo entre duas rodadas foi bem maior que o normal, o
 * computador dormiu: o que venceu nesse tempo conta como atrasado.
 */
function detectarSono() {
    const agora = Date.now();
    const anterior = estado.ultimoCicloPublicacoes;
    const limite = config.publicador.intervaloPublicacoesMs * 3 + 30 * 1000;

    if (anterior && agora - anterior > limite) {
        log.aviso("O computador ficou parado (sono ou travamento); horários vencidos nesse tempo ficam atrasados.");
        estado.acordadoDesde = agora;
    }
}

/** Avisa quem estiver ouvindo (app Publicador) sobre as atrasadas. */
async function avisarAtrasadas() {
    try {
        const lista = await publicacoesRepository.listarPorStatus(STATUS.ATRASADA);
        if (lista.length > 0) eventos.emit("atrasadas", lista);
    } catch (erro) {
        log.aviso("Não foi possível listar as publicações atrasadas", formatarErro(erro));
    }
}

/**
 * Publicações que ficaram "publicando" quando o Publicador fechou: não se
 * sabe se saíram, então viram erro (sem nova tentativa automática).
 */
async function encerrarInterrompidas() {
    const interrompidas = await publicacoesRepository.listarPorStatus(STATUS.PUBLICANDO);

    for (const publicacao of interrompidas) {
        await publicacoesRepository.atualizar(publicacao.id, {
            status: STATUS.ERRO,
            erro:
                "Resultado incerto: o Publicador foi fechado durante a publicação. " +
                "Confira no Instagram antes de publicar de novo."
        }).catch((erro) => log.erro(`Não foi possível marcar a publicação ${publicacao.id}`, formatarErro(erro)));
    }

    return interrompidas.length;
}

/* -------------------------------- Tarefas -------------------------------- */

/** Abre o Chromium para o login e espera terminar (até 10 min). */
async function executarConexao(tarefa) {
    const instagramAuth = require("../services/instagram-auth.service");
    let atual = await instagramAuth.iniciar(tarefa.conta_id);
    const limite = Date.now() + LIMITE_CONEXAO_MS;

    await tarefasRepository.informar(tarefa.id, atual.mensagem).catch(() => {});

    while (["iniciando", "aguardando_login"].includes(atual.status)) {
        if (Date.now() > limite) {
            await instagramAuth.desconectarProcesso(tarefa.conta_id);
            return { sucesso: false, mensagem: "Tempo esgotado: o login não foi concluído em 10 minutos." };
        }
        await new Promise((r) => setTimeout(r, 2500));
        atual = await instagramAuth.consultar(tarefa.conta_id);
    }

    return {
        sucesso: atual.status === "conectado",
        mensagem: atual.mensagem,
        resultado: { status: atual.status }
    };
}

async function executarTarefa(tarefa) {
    if (tarefa.tipo === TIPOS.CONECTAR) return executarConexao(tarefa);

    if (tarefa.tipo === TIPOS.DESCONECTAR) {
        const instagramAuth = require("../services/instagram-auth.service");
        const r = await instagramAuth.desconectar(tarefa.conta_id);
        return { sucesso: true, mensagem: r.mensagem };
    }

    if (tarefa.tipo === TIPOS.COLETAR_COMENTARIOS) {
        const comentariosService = require("../services/comentarios.service");
        const resultado = await comentariosService.coletarComentarios(tarefa.publicacao_id);
        return { sucesso: true, mensagem: "Comentários atualizados.", resultado };
    }

    return { sucesso: false, mensagem: `Tipo de pedido desconhecido: ${tarefa.tipo}` };
}

/**
 * Pega e executa os pedidos pendentes. Cada um roda em paralelo (o login
 * pode levar minutos); o que usa o navegador para publicar/coletar entra
 * na fila da automação, um por vez.
 */
async function cicloTarefas() {
    if (estado.lendoTarefas) return;
    estado.lendoTarefas = true;

    try {
        const pendentes = await tarefasRepository.listarPendentes();

        for (const pendente of pendentes) {
            const tarefa = await tarefasRepository.pegar(pendente.id);
            if (!tarefa) continue;

            estado.tarefasEmAndamento.add(tarefa.id);
            log.info(`Pedido ${tarefa.id}: ${tarefa.tipo}`, { conta: tarefa.conta_id, publicacao: tarefa.publicacao_id });

            executarTarefa(tarefa)
                .catch((erro) => ({ sucesso: false, mensagem: formatarErro(erro) }))
                .then((fim) => tarefasRepository.concluir(tarefa.id, fim).then(() => fim))
                .then((fim) => eventos.emit("tarefa", { ...tarefa, ...fim }))
                .catch((erro) => log.erro(`Não foi possível concluir o pedido ${tarefa.id}`, formatarErro(erro)))
                .finally(() => estado.tarefasEmAndamento.delete(tarefa.id));
        }
    } catch (erro) {
        log.erro("Falha ao consultar os pedidos do site", formatarErro(erro));
    } finally {
        estado.lendoTarefas = false;
    }
}

/* -------------------------------- Sessões -------------------------------- */

/**
 * Informa ao banco quais perfis têm sessão salva NESTE computador (o site
 * na Vercel não vê o disco). Sem a migração 011, apenas avisa.
 */
async function sincronizarSessoes() {
    const { obterArquivoSessao } = require("../automacao/instagram/sessao");
    const contas = await contasRepository.listarAtivas();

    for (const conta of contas) {
        let existe = false;
        let quando = null;
        try {
            const arquivo = obterArquivoSessao(conta.id);
            existe = fs.existsSync(arquivo);
            if (existe) quando = fs.statSync(arquivo).mtime.toISOString();
        } catch {
            existe = false;
        }

        const marcada = Boolean(conta.sessao_salva_em);
        if (existe === marcada) continue;

        try {
            await contasRepository.definirSessaoSalva(conta.id, existe ? quando : null);
        } catch (erro) {
            log.aviso("Não foi possível sincronizar as sessões (execute a migração 011)", formatarErro(erro));
            return;
        }
    }
}

/* ------------------------------ Sinal de vida ---------------------------- */

async function sinalizar(extra) {
    try {
        await publicadorRepository.sinalizar(extra);
    } catch (erro) {
        log.aviso("Não foi possível gravar o sinal do Publicador (execute a migração 011)", formatarErro(erro));
    }
}

/* ------------------------------- Controle -------------------------------- */

/**
 * Liga o Publicador. Antes de publicar qualquer coisa, organiza o que
 * ficou para trás enquanto estava desligado.
 *
 * @param {{versao?: string}} [opcoes]
 * @returns {Promise<{atrasadas: object[], interrompidas: number}>}
 */
async function iniciar({ versao = "" } = {}) {
    if (estado.ativo) return { atrasadas: [], interrompidas: 0 };

    estado.ativo = true;
    estado.acordadoDesde = Date.now();
    estado.ultimoCicloPublicacoes = 0;

    await sinalizar({ iniciado_em: new Date().toISOString(), maquina: os.hostname(), versao });

    const interrompidas = await encerrarInterrompidas().catch((erro) => {
        log.erro("Não foi possível conferir publicações interrompidas", formatarErro(erro));
        return 0;
    });
    await tarefasRepository.encerrarInterrompidas().catch(() => 0);
    await sincronizarSessoes().catch((erro) => log.aviso("Falha ao sincronizar sessões", formatarErro(erro)));

    // Primeira rodada: o que venceu com o Publicador desligado vira atrasada.
    await cicloPublicacoes();

    const atrasadas = await publicacoesRepository.listarPorStatus(STATUS.ATRASADA).catch(() => []);

    const repetir = (fn, ms) => {
        const t = setInterval(() => { if (estado.ativo) fn(); }, ms);
        estado.timers.push(t);
    };
    repetir(cicloPublicacoes, config.publicador.intervaloPublicacoesMs);
    repetir(cicloTarefas, config.publicador.intervaloTarefasMs);
    repetir(() => sinalizar(), config.publicador.intervaloSinalMs);
    repetir(() => sincronizarSessoes().catch(() => {}), 5 * 60 * 1000);

    cicloTarefas();

    log.info("Publicador ligado", { atrasadas: atrasadas.length, interrompidas });
    if (atrasadas.length > 0) eventos.emit("atrasadas", atrasadas);

    return { atrasadas, interrompidas };
}

/** Desliga (fechamento normal): o site mostra "desligado" na hora. */
async function parar() {
    if (!estado.ativo) return;
    estado.ativo = false;
    estado.timers.forEach(clearInterval);
    estado.timers = [];
    await publicadorRepository.desligar().catch(() => {});
    log.info("Publicador desligado");
}

/** Pede uma rodada de publicações já (ex.: "publicar agora" no modo completo). */
function acordar() {
    if (estado.ativo) setImmediate(() => cicloPublicacoes());
}

/** O computador voltou do sono (app Publicador): horários vencidos ficam atrasados. */
function voltouDoSono() {
    if (!estado.ativo) return;
    estado.acordadoDesde = Date.now();
    acordar();
}

/** Agendadas que ainda vão sair (alerta antes de desligar). */
async function proximasAgendadas() {
    const lista = await publicacoesRepository.listarProximas(new Date().toISOString());
    return lista.filter((p) => p.aprovacao !== APROVACAO.INDEFERIDA);
}

function estaAtivo() {
    return estado.ativo;
}

/** Há publicação ou pedido rodando agora (evita fechar no meio). */
function ocupado() {
    return estado.publicando || estado.tarefasEmAndamento.size > 0;
}

module.exports = {
    eventos,
    iniciar,
    parar,
    acordar,
    voltouDoSono,
    proximasAgendadas,
    estaAtivo,
    ocupado,
    // Exportados para testes.
    _interno: { tratarVencida, cicloPublicacoes, cicloTarefas, sincronizarSessoes, estado, MENSAGEM_PRAZO_ESGOTADO }
};
