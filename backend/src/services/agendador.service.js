/**
 * Agendador de publicações em memória.
 *
 * Mantém um `setTimeout` por publicação agendada. Os timers vivem no
 * processo, então ao iniciar o servidor `restaurarPendentes()` relê o
 * banco e recria os agendamentos que se perderam no reinício.
 */
const { criarLogger } = require("../lib/logger");
const { formatarErro } = require("../lib/erros");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const { executarPublicacao } = require("./publicador.service");

const { STATUS } = publicacoesRepository;
const log = criarLogger("Agendador");

/** Maior atraso suportado por `setTimeout` no Node.js (2^31 - 1 ms ≈ 24,8 dias). */
const LIMITE_TIMER_MS = 2147483647;

/**
 * Atraso máximo aceito ao restaurar agendamentos depois de um reinício.
 * Uma publicação cujo horário passou há mais que isso NÃO é publicada
 * (um post de "bom dia" não deve sair à noite): fica com status `erro`
 * para ser reagendada manualmente.
 */
const ATRASO_MAXIMO_MS = 60 * 60 * 1000; // 1 hora

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

    if (espera > LIMITE_TIMER_MS) {
        log.debug(
            `Publicação ${id} muito distante para um único timer; reagendando em etapas.`
        );
    }

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

/**
 * Marca uma publicação com erro sem lançar exceção, para que uma falha
 * não interrompa a restauração das demais.
 *
 * @param {number} id
 * @param {string} mensagem
 * @returns {Promise<boolean>} `true` se o status foi gravado.
 */
async function marcarErro(id, mensagem) {
    try {
        await publicacoesRepository.atualizar(id, {
            status: STATUS.ERRO,
            erro: mensagem
        });
        return true;
    } catch (erro) {
        log.erro(
            `Não foi possível marcar a publicação ${id} com erro`,
            formatarErro(erro)
        );
        return false;
    }
}

/**
 * Recupera o estado do agendador a partir do banco. Deve ser chamada uma
 * vez, ao iniciar o servidor e ANTES de aceitar requisições.
 *
 * - `publicando`: o processo anterior caiu no meio da automação. Não se
 *   sabe se o post saiu, então vira `erro` (sem nova tentativa, para não
 *   arriscar um post duplicado).
 * - `agendada` com data futura: volta a ser agendada.
 * - `agendada` atrasada até `ATRASO_MAXIMO_MS`: é publicada agora.
 * - `agendada` atrasada além disso: vira `erro` ("horário perdido").
 *
 * @returns {Promise<{reagendadas: number, perdidas: number,
 *                    interrompidas: number}>}
 */
async function restaurarPendentes() {
    const [agendadas, interrompidas] = await Promise.all([
        publicacoesRepository.listarPorStatus(STATUS.AGENDADA),
        publicacoesRepository.listarPorStatus(STATUS.PUBLICANDO)
    ]);

    for (const publicacao of interrompidas) {
        log.aviso(`Publicação ${publicacao.id} foi interrompida por um reinício`);

        await marcarErro(
            publicacao.id,
            "Resultado incerto: o servidor reiniciou durante a publicação. " +
            "Confira no Instagram antes de publicar de novo."
        );
    }

    let reagendadas = 0;
    let perdidas = 0;

    for (const publicacao of agendadas) {
        const horario = new Date(publicacao.data_hora);
        const atraso = Date.now() - horario.getTime();

        if (!Number.isFinite(atraso)) {
            perdidas++;
            await marcarErro(
                publicacao.id,
                "Agendamento com data inválida; reagende a publicação."
            );
            continue;
        }

        if (atraso > ATRASO_MAXIMO_MS) {
            perdidas++;
            log.aviso(`Publicação ${publicacao.id} perdeu o horário`, {
                data: horario.toISOString()
            });
            await marcarErro(
                publicacao.id,
                `Horário perdido: o servidor estava desligado em ` +
                `${horario.toLocaleString("pt-BR")}. Reagende a publicação.`
            );
            continue;
        }

        // Futura: agenda normalmente. Atrasada dentro da tolerância:
        // `agendar` executa na hora (a fila garante uma por vez).
        agendar(publicacao);
        reagendadas++;
    }

    const resumo = {
        reagendadas,
        perdidas,
        interrompidas: interrompidas.length
    };

    log.info("Agendamentos restaurados do banco", resumo);

    return resumo;
}

module.exports = { agendar, cancelar, restaurarPendentes };
