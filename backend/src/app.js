/**
 * Montagem da aplicação Express (sem iniciar o servidor).
 *
 * Separar `app` de `listen` (feito em `server.js`) permite testar a API
 * com ferramentas como supertest sem abrir uma porta.
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const { config } = require("./config/env");
const routes = require("./routes");
const { requisicoes } = require("./middlewares/requisicoes");
const { rotaNaoEncontrada, tratarErros } = require("./middlewares/erros");
const { linkTemporario } = require("./lib/imagens");

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
    // 4 MB: a coleta de comentários enviada pelo app Publicador pode ser grande.
    app.use(express.json({ limit: "4mb" }));
    app.use(express.urlencoded({ extended: true }));

    // Imagens das postagens, para o frontend exibir as miniaturas.
    if (config.imagensNoSupabase) {
        // Storage privado: redireciona para um link temporário. Imagens
        // antigas que só existem neste computador saem direto do disco.
        app.get("/uploads/:nome", async (req, res) => {
            const local = path.join(config.diretorios.uploads, path.basename(req.params.nome));
            if (fs.existsSync(local)) return res.sendFile(local);

            const link = await linkTemporario(req.params.nome);
            if (!link) return res.status(404).json({ sucesso: false, mensagem: "Imagem não encontrada." });
            res.set("Cache-Control", "private, max-age=3000");
            res.redirect(302, link);
        });
    } else {
        app.use(
            "/uploads",
            express.static(config.diretorios.uploads, {
                dotfiles: "deny",
                index: false
            })
        );
    }

    app.use(routes);

    // Devem ser os últimos middlewares registrados.
    app.use(rotaNaoEncontrada);
    app.use(tratarErros);

    return app;
}

module.exports = { criarApp };
