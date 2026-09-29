/**
 * Ponto de entrada do backend: `npm run dev -w backend` (ou `start`).
 */
const fs = require("fs");

const { config } = require("./config/env");
const { criarLogger } = require("./lib/logger");
const { criarApp } = require("./app");

const log = criarLogger("Servidor");

fs.mkdirSync(config.diretorios.logs, { recursive: true });

criarApp().listen(config.porta, () => {
    log.info(`Servidor rodando em http://localhost:${config.porta}`);
});
