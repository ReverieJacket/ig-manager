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
const fs = require("fs");
const path = require("path");
const pino = require("pino");

const { config } = require("../config/env");

/**
 * Monta os destinos de saída conforme o ambiente.
 *
 * As gravações são SÍNCRONAS e feitas no próprio processo (sem thread
 * auxiliar). É um pouco menos performático que o modo assíncrono, mas
 * garante que nada se perca se o processo for encerrado de forma abrupta
 * (Ctrl+C, `node --watch`, falha) e que erros de gravação apareçam.
 */
function criarSaida() {
    const nivel = config.log.nivel;
    const destinos = [];

    if (config.emProducao) {
        destinos.push({
            level: nivel,
            stream: pino.destination({ dest: 1, sync: true })
        });
    } else {
        // pino-pretty é dependência de desenvolvimento: só é carregado aqui.
        const pretty = require("pino-pretty");

        destinos.push({
            level: nivel,
            stream: pretty({
                colorize: true,
                translateTime: "SYS:HH:MM:ss.l",
                singleLine: true,
                ignore: "pid,hostname,escopo,req,res",
                messageFormat: "[{escopo}] {msg}",
                sync: true
            })
        });
    }

    if (config.log.emArquivo) {
        fs.mkdirSync(path.dirname(config.log.arquivo), { recursive: true });

        const arquivo = pino.destination({
            dest: config.log.arquivo,
            sync: true
        });

        arquivo.on("error", (erro) => {
            console.error(
                `[logger] Falha ao gravar o arquivo de log: ${erro.message}`
            );
        });

        destinos.push({ level: nivel, stream: arquivo });
    }

    return pino.multistream(destinos);
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
    criarSaida()
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
