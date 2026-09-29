/**
 * Agendador de publicações em memória.
 *
 * Mantém um `setTimeout` por publicação agendada. ATENÇÃO: os timers
 * vivem no processo; se o servidor reiniciar, publicações com status
 * `agendada` deixam de ser executadas até que sejam reagendadas
 * (ver "Limitações conhecidas" no README).
 */
const { criarLogger } = require("../lib/logger");
const { formatarErro } = require("../lib/erros");
const { executarPublicacao } = require("./publicador.service");

const log = criarLogger("Agendador");

/** Maior atraso suportado por `setTimeout` no Node.js (2^31 - 1 ms ≈ 24,8 dias). */
const LIMITE_TIMER_MS = 2147483647;

/** Timers pendentes, indexados pelo id da publicação. */
const timers = new Map();

/**
 * Cancela o agendamento de uma publicação, se existir.
 *
 * @param {number} id - Identificador da publicação.
 */
function cancelar(id) {
    const timer = timers.get(id);

    if (timer) {
        clearTimeout(timer);
        timers.delete(id);
    }
}

/**
 * Agenda a execução de uma publicação para `publicacao.data_hora`.
 *
 * - Data já passada: executa imediatamente.
 * - Data além do limite do `setTimeout`: reagenda em etapas até chegar
 *   a hora certa.
 *
 * @param {{id: number, data_hora: string}} publicacao - Registro do banco.
 */
function agendar(publicacao) {
    const id = publicacao.id;
    const alvo = new Date(publicacao.data_hora);
    const espera = alvo.getTime() - Date.now();

    cancelar(id);

    if (!Number.isFinite(espera) || espera <= 0) {
        executarPublicacao(publicacao).catch((erro) => {
            log.erro(`Erro inesperado no agendamento ${id}`, formatarErro(erro));
        });
        return;
    }

    const proximoPasso = Math.min(espera, LIMITE_TIMER_MS);

    const timer = setTimeout(() => {
        timers.delete(id);

        if (espera > LIMITE_TIMER_MS) {
            agendar(publicacao);
            return;
        }

        executarPublicacao(publicacao).catch((erro) => {
            log.erro(`Erro inesperado no agendamento ${id}`, formatarErro(erro));
        });
    }, proximoPasso);

    timers.set(id, timer);

    log.info(`Publicação ${id} agendada`, {
        data: alvo.toISOString(),
        milissegundos: espera
    });
}

module.exports = { agendar, cancelar };
