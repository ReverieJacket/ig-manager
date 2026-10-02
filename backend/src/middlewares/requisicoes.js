/**
 * Registro automático de cada requisição HTTP (pino-http).
 *
 * Gera uma linha por requisição, com método, rota, status e tempo de
 * resposta, e um identificador (`req.id`) que também aparece nos logs
 * emitidos durante a mesma requisição (via `req.log`).
 *
 * Nível: 5xx = error, 4xx = warn, demais = info.
 */
const { randomUUID } = require("crypto");
const pinoHttp = require("pino-http");

const { logger } = require("../lib/logger");

const requisicoes = pinoHttp({
    logger: logger.child({ escopo: "HTTP" }),

    genReqId: (req, res) => {
        const id = req.headers["x-request-id"] || randomUUID();
        res.setHeader("x-request-id", id);
        return id;
    },

    customLogLevel: (req, res, erro) => {
        if (erro || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
    },

    customSuccessMessage: (req, res) =>
        `${req.method} ${req.url} ${res.statusCode}`,

    customErrorMessage: (req, res) =>
        `${req.method} ${req.url} ${res.statusCode}`,

    // Só o essencial: evita gravar cabeçalhos e corpo inteiros.
    serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode })
    },

    // Arquivos estáticos (miniaturas) geram muito ruído.
    autoLogging: {
        ignore: (req) => req.url.startsWith("/uploads")
    }
});

module.exports = { requisicoes };
