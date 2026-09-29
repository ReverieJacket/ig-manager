/**
 * Montagem da aplicação Express (sem iniciar o servidor).
 *
 * Separar `app` de `listen` (feito em `server.js`) permite testar a API
 * com ferramentas como supertest sem abrir uma porta.
 */
const express = require("express");
const cors = require("cors");

const { config } = require("./config/env");
const routes = require("./routes");
const { rotaNaoEncontrada, tratarErros } = require("./middlewares/erros");

/**
 * Cria e configura a aplicação Express.
 *
 * @returns {import("express").Express}
 */
function criarApp() {
    const app = express();

    app.use(cors(config.corsOrigin ? { origin: config.corsOrigin } : undefined));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Imagens enviadas, para o frontend exibir as miniaturas.
    // Em produção, prefira armazenamento persistente (ex.: Supabase Storage).
    app.use(
        "/uploads",
        express.static(config.diretorios.uploads, {
            dotfiles: "deny",
            index: false
        })
    );

    app.use(routes);

    // Devem ser os últimos middlewares registrados.
    app.use(rotaNaoEncontrada);
    app.use(tratarErros);

    return app;
}

module.exports = { criarApp };
