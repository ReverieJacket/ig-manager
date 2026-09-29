/**
 * Logger central da aplicação (baseado no pino).
 *
 * - Desenvolvimento: saída colorida e legível no terminal (pino-pretty).
 * - Produção (`NODE_ENV=production`): uma linha JSON por evento, pronta
 *   para ferramentas de log (Datadog, Loki, CloudWatch etc.).
 * - Nível controlado por `LOG_LEVEL` (debug | info | warn | error | silent).
 * - Opcional: `LOG_EM_ARQUIVO=true` grava também em `storage/logs/backend.log`.
 *
 * Campos sensíveis (cookies, tokens, chaves) são removidos automaticamente
 * caso apareçam em um evento.
 */
const path = require("path");
const pino = require("pino");

const { config } = require("../config/env");

/** Destinos de saída conforme o ambiente. */
function criarAlvos() {
    const nivel = config.log.nivel;

    const alvos = [
        config.emProducao
            ? { target: "pino/file", level: nivel, options: { destination: 1 } }
            : {
                target: "pino-pretty",
                level: nivel,
                options: {
                    colorize: true,
                    translateTime: "SYS:HH:MM:ss.l",
                    singleLine: true,
                    ignore: "pid,hostname,escopo,req,res",
                    messageFormat: "[{escopo}] {msg}"
                }
            }
    ];

    if (config.log.emArquivo) {
        alvos.push({
            target: "pino/file",
            level: nivel,
            options: {
                destination: path.join(config.diretorios.logs, "backend.log"),
                mkdir: true
            }
        });
    }

    return alvos;
}

/** Instância raiz do pino, compartilhada por todos os escopos. */
const logger = pino(
    {
        level: config.log.nivel,
        timestamp: pino.stdTimeFunctions.isoTime,
        redact: {
            paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "*.senha",
                "*.password",
                "*.token",
                "*.cookies",
                "*.SUPABASE_SERVICE_ROLE_KEY"
            ],
            censor: "[REMOVIDO]"
        }
    },
    pino.transport({ targets: criarAlvos() })
);

/**
 * Cria um logger identificado por um escopo (ex.: "Publicador").
 *
 * Mantém a interface `(mensagem, dados?)` usada no projeto. `dados` pode
 * ser um objeto, um valor simples ou um `Error` (nesse caso a pilha de
 * chamadas é registrada).
 *
 * @param {string} escopo - Módulo de origem; vira o campo `escopo` do log.
 * @returns {{debug: Function, info: Function, aviso: Function, erro: Function}}
 */
function criarLogger(escopo) {
    const filho = logger.child({ escopo });

    const emitir = (nivel) => (mensagem, dados) => {
        if (dados === undefined) {
            filho[nivel](mensagem);
            return;
        }

        let contexto;

        if (dados instanceof Error) {
            contexto = { err: dados };
        } else if (typeof dados === "object" && dados !== null) {
            contexto = { dados };
        } else {
            contexto = { detalhe: dados };
        }

        filho[nivel](contexto, mensagem);
    };

    return {
        debug: emitir("debug"),
        info: emitir("info"),
        aviso: emitir("warn"),
        erro: emitir("error")
    };
}

module.exports = { criarLogger, logger };
