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
const { requisicoes } = require("./middlewares/requisicoes");
const { rotaNaoEncontrada, tratarErros } = require("./middlewares/erros");

/**
 * Cria e configura a aplicação Express.
 *
 * @returns {import("express").Express}
 */
function criarApp() {
    const app = express();

    // Primeiro, para registrar todas as requisições (inclusive as recusadas).
    app.use(requisicoes);
    // `credentials: true` deixa o navegador enviar o cookie de sessão; para
    // isso a origem precisa ser explícita (nunca "qualquer origem").
    app.use(
        cors({
            origin: config.corsOrigin || config.frontendUrl,
            credentials: true
        })
    );
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
