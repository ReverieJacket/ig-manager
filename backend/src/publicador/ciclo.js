/**
 * Publicador: o "trabalhador" que fala com o Instagram.
 *
 * Roda no computador do administrador (app Publicador, `npm run
 * publicador` ou dentro do backend no modo "completo"). Em vez de timers,
 * consulta o servidor:
 * - a cada 15 s: publica as agendadas cujo horário chegou;
 * - a cada 4 s: executa os pedidos do site (conectar, desconectar,
 *   coletar comentários);
 * - a cada 30 s: grava o "sinal de vida" que o site usa para mostrar se o
 *   Publicador está ligado.
 *
 * O acesso aos dados é uma "porta": direto no banco (`porta-local`) ou pelo
 * site com o login do administrador (`porta-remota`, app instalado). As
 * regras são as mesmas (`services/publicador-servidor.service.js`).
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
const automacao = require("./automacao");

const log = criarLogger("Publicador");

/** Tempo máximo esperando o login de uma conexão. */
const LIMITE_CONEXAO_MS = 10 * 60 * 1000;

const TIPOS = Object.freeze({
    CONECTAR: "conectar",
    DESCONECTAR: "desconectar",
    COLETAR_COMENTARIOS: "coletar_comentarios"
});

const eventos = new EventEmitter();

const estado = {
    ativo: false,
    porta: null,
    /** Desde quando o Publicador está ligado sem interrupção (nem sono). */
    acordadoDesde: 0,
    ultimoCicloPublicacoes: 0,
    publicando: false,
    repetirPublicacoes: false,
    lendoTarefas: false,
    timers: [],
    tarefasEmAndamento: new Set()
};

/** Sessão do login perdida (app instalado): avisa e não insiste. */
function tratarErroGeral(erro, contexto) {
    if (erro?.sessao) {
        eventos.emit("sessaoPerdida", erro);
        return;
    }
    log.erro(contexto, formatarErro(erro));
}

/* ------------------------------ Publicações ------------------------------ */

/**
 * Uma agendada vencida: o servidor decide (prazo, atrasada ou publicar) e
 * reserva; se for publicar, a automação roda aqui e o resultado volta.
 *
 * @returns {Promise<"publicada"|"atrasada"|"ignorada">}
 */
async function tratarVencida(item) {
    const porta = estado.porta;
    const decisao = await porta.tratar(item.id, estado.acordadoDesde);

    if (decisao.acao === "atrasada") return "atrasada";
    if (decisao.acao !== "publicar") return "ignorada";

    const { publicacao, conta } = decisao;
    let resultado;

    try {
        const caminhoImagem = await porta.baixarImagem(publicacao);
        resultado = await automacao.publicar({
            id: publicacao.id,
            caminhoImagem,
            texto: publicacao.texto,
            mimetype: publicacao.mimetype,
            conta
        });
    } catch (erro) {
        if (erro?.sessao) throw erro;
        resultado = { sucesso: false, mensagem: formatarErro(erro) };
    }

    const gravado = await porta.registrarResultado(publicacao.id, resultado);
    const final = gravado && typeof gravado.sucesso === "boolean" ? gravado : { id: publicacao.id, ...resultado };

    eventos.emit("publicacao", { id: publicacao.id, ...final });

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

            const vencidas = await estado.porta.vencidas();
            let atrasadas = 0;

            for (const item of vencidas) {
                if (!estado.ativo) return;
                try {
                    if ((await tratarVencida(item)) === "atrasada") atrasadas++;
                } catch (erro) {
                    if (erro?.sessao) throw erro;
                    log.erro(`Erro ao tratar a publicação ${item.id}`, formatarErro(erro));
                }
            }

            if (atrasadas > 0) await avisarAtrasadas();
            estado.ultimoCicloPublicacoes = Date.now();
        } while (estado.repetirPublicacoes && estado.ativo);
    } catch (erro) {
        tratarErroGeral(erro, "Falha ao consultar as publicações agendadas");
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
        const lista = await estado.porta.atrasadas();
        if (lista.length > 0) eventos.emit("atrasadas", lista);
    } catch (erro) {
        tratarErroGeral(erro, "Não foi possível listar as publicações atrasadas");
    }
}

/* -------------------------------- Tarefas -------------------------------- */

/** Abre o navegador para o login e espera terminar (até 10 min). */
async function executarConexao(pedido) {
    const instagramAuth = require("../services/instagram-auth.service");
    const contaId = pedido.tarefa.conta_id;
    let atual = await instagramAuth.iniciar(contaId);
    const limite = Date.now() + LIMITE_CONEXAO_MS;

    await estado.porta.informarTarefa(pedido.tarefa.id, atual.mensagem).catch(() => {});

    while (["iniciando", "aguardando_login"].includes(atual.status)) {
        if (Date.now() > limite) {
            await instagramAuth.desconectarProcesso(contaId);
            return { sucesso: false, mensagem: "Tempo esgotado: o login não foi concluído em 10 minutos." };
        }
        await new Promise((r) => setTimeout(r, 2500));
        atual = await instagramAuth.consultar(contaId);
    }

    return {
        sucesso: atual.status === "conectado",
        mensagem: atual.mensagem,
        resultado: { status: atual.status }
    };
}

async function executarTarefa(pedido) {
    const { tarefa } = pedido;

    if (tarefa.tipo === TIPOS.CONECTAR) return executarConexao(pedido);

    if (tarefa.tipo === TIPOS.DESCONECTAR) {
        const instagramAuth = require("../services/instagram-auth.service");
        const r = await instagramAuth.desconectar(tarefa.conta_id);
        return { sucesso: true, mensagem: r.mensagem };
    }

    if (tarefa.tipo === TIPOS.COLETAR_COMENTARIOS) {
        const publicacao = pedido.publicacao;
        if (!publicacao?.ig_codigo) {
            return { sucesso: false, mensagem: "Esta publicação não tem o código do post no Instagram." };
        }
        const coleta = await automacao.coletarComentarios(publicacao);
        const resultado = await estado.porta.salvarComentarios(publicacao.id, coleta);
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

    const porta = estado.porta;

    try {
        const pendentes = await porta.tarefasPendentes();

        for (const pendente of pendentes) {
            const pedido = await porta.pegarTarefa(pendente.id);
            if (!pedido) continue;

            const { tarefa } = pedido;
            estado.tarefasEmAndamento.add(tarefa.id);
            log.info(`Pedido ${tarefa.id}: ${tarefa.tipo}`, { conta: tarefa.conta_id, publicacao: tarefa.publicacao_id });

            executarTarefa(pedido)
                .catch((erro) => ({ sucesso: false, mensagem: formatarErro(erro) }))
                .then((fim) => porta.concluirTarefa(tarefa.id, fim).then(() => fim))
                .then((fim) => eventos.emit("tarefa", { ...tarefa, ...fim }))
                .catch((erro) => tratarErroGeral(erro, `Não foi possível concluir o pedido ${tarefa.id}`))
                .finally(() => estado.tarefasEmAndamento.delete(tarefa.id));
        }
    } catch (erro) {
        tratarErroGeral(erro, "Falha ao consultar os pedidos do site");
    } finally {
        estado.lendoTarefas = false;
    }
}

/* -------------------------------- Sessões -------------------------------- */

/**
 * Informa ao servidor quais perfis têm sessão salva NESTE computador (o
 * site não vê o disco). Sem a migração 011, apenas avisa.
 */
async function sincronizarSessoes() {
    const { obterArquivoSessao } = require("../automacao/instagram/sessao");
    const contas = await estado.porta.contasAtivas();

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

        if (existe === Boolean(conta.sessao_salva_em)) continue;

        try {
            await estado.porta.definirSessao(conta.id, existe ? quando : null);
        } catch (erro) {
            if (erro?.sessao) throw erro;
            log.aviso("Não foi possível sincronizar as sessões (execute a migração 011)", formatarErro(erro));
            return;
        }
    }
}

/* ------------------------------- Controle -------------------------------- */

/**
 * Liga o Publicador. Antes de publicar qualquer coisa, organiza o que
 * ficou para trás enquanto estava desligado.
 *
 * @param {{versao?: string, porta?: object}} [opcoes] - Sem `porta`: banco direto.
 * @returns {Promise<{atrasadas: object[], interrompidas: number}>}
 */
async function iniciar({ versao = "", porta } = {}) {
    if (estado.ativo) return { atrasadas: [], interrompidas: 0 };

    estado.porta = porta || require("./porta-local").criarPortaLocal();

    // App instalado: a conexão de perfis também conversa pelo site.
    if (estado.porta.tipo === "remota") {
        require("../services/instagram-auth.service").configurar({
            buscarConta: (id) => estado.porta.contaParaConectar(id),
            sessaoSalva: (id) => estado.porta.definirSessao(id, new Date().toISOString()),
            sessaoRemovida: (id) => estado.porta.definirSessao(id, null)
        });
    }

    // Antes de ligar: se o login não vale, nada é marcado como ativo.
    const inicio = await estado.porta.iniciar({ maquina: os.hostname(), versao });

    estado.ativo = true;
    estado.acordadoDesde = Date.now();
    estado.ultimoCicloPublicacoes = 0;

    await sincronizarSessoes().catch((erro) => tratarErroGeral(erro, "Falha ao sincronizar sessões"));

    // Primeira rodada: o que venceu com o Publicador desligado vira atrasada.
    await cicloPublicacoes();

    const atrasadas = await estado.porta.atrasadas().catch(() => []);

    const repetir = (fn, ms) => {
        const t = setInterval(() => { if (estado.ativo) fn(); }, ms);
        estado.timers.push(t);
    };
    repetir(cicloPublicacoes, config.publicador.intervaloPublicacoesMs);
    repetir(cicloTarefas, config.publicador.intervaloTarefasMs);
    repetir(() => estado.porta.sinalizar().catch((e) => tratarErroGeral(e, "Falha ao enviar o sinal")), config.publicador.intervaloSinalMs);
    repetir(() => sincronizarSessoes().catch((e) => tratarErroGeral(e, "Falha ao sincronizar sessões")), 5 * 60 * 1000);

    cicloTarefas();

    // Envia ao Storage as imagens antigas deste computador (só com banco direto).
    if (estado.porta.tipo === "local") enviarImagensAntigas();

    const interrompidas = inicio?.interrompidas || 0;
    log.info("Publicador ligado", { atrasadas: atrasadas.length, interrompidas });
    if (atrasadas.length > 0) eventos.emit("atrasadas", atrasadas);

    return { atrasadas, interrompidas };
}

/**
 * Postagens antigas guardaram a imagem só neste computador: envia ao
 * Supabase Storage para as miniaturas aparecerem no site da Vercel.
 */
async function enviarImagensAntigas() {
    try {
        const publicacoesRepository = require("../repositories/publicacoes.repository");
        const { enviarLocaisAoStorage } = require("../lib/imagens");
        const nomes = [];
        for (const status of Object.values(publicacoesRepository.STATUS)) {
            const lista = await publicacoesRepository.listarPorStatus(status).catch(() => []);
            nomes.push(...lista.map((p) => p.imagem));
        }
        const novas = await enviarLocaisAoStorage(nomes);
        if (novas > 0) log.info(`${novas} imagem(ns) antiga(s) enviada(s) ao Supabase Storage`);
    } catch (erro) {
        log.aviso("Não foi possível enviar as imagens antigas ao Storage (execute a migração 011)", formatarErro(erro));
    }
}

/** Desliga (fechamento normal): o site mostra "desligado" na hora. */
async function parar({ avisarServidor = true } = {}) {
    if (!estado.ativo) return;
    estado.ativo = false;
    estado.timers.forEach(clearInterval);
    estado.timers = [];
    if (avisarServidor) await estado.porta.desligar().catch(() => {});
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
    return estado.porta ? estado.porta.proximas() : [];
}

/** Atrasadas agora (janela do app). */
async function listarAtrasadas() {
    return estado.porta ? estado.porta.atrasadas() : [];
}

/** Publicar agora / reagendar uma atrasada. */
async function retomar(id, dados) {
    const r = await estado.porta.retomar(id, dados);
    acordar();
    return r;
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
    listarAtrasadas,
    retomar,
    estaAtivo,
    ocupado,
    // Exportados para testes.
    _interno: { tratarVencida, cicloPublicacoes, cicloTarefas, sincronizarSessoes, estado }
};
