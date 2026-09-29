/**
 * Ponto de entrada do backend: `npm run dev -w backend` (ou `start`).
 */
const fs = require("fs");

const { config } = require("./config/env");
const { criarLogger } = require("./lib/logger");
const { criarApp } = require("./app");

const log = criarLogger("Servidor");

fs.mkdirSync(config.diretorios.logs, { recursive: true });

// Rede de segurança: sem estes ouvintes, uma falha fora das rotas (por
// exemplo, dentro de um timer do agendador) passaria sem registro.
process.on("unhandledRejection", (motivo) => {
    log.erro("Promessa rejeitada sem tratamento", motivo);
});

process.on("uncaughtException", (erro) => {
    log.erro("Exceção não capturada; encerrando o processo", erro);
    // O estado do processo é incerto após uma exceção: melhor reiniciar.
    setTimeout(() => process.exit(1), 100);
});

criarApp().listen(config.porta, () => {
    log.info(`Servidor rodando em http://localhost:${config.porta}`, {
        ambiente: config.emProducao ? "producao" : "desenvolvimento",
        nivelLog: config.log.nivel
    });
});
