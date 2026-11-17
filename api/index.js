/**
 * API do IG Manager na Vercel (função serverless).
 *
 * A Vercel chama este arquivo para todo endereço `/api/...` (ver
 * `vercel.json`). É o mesmo Express do backend, no modo "api": sem
 * navegador; publicar, conectar e coletar comentários viram pedidos para o
 * Publicador (app no computador do administrador).
 */
process.env.IG_MODO = process.env.IG_MODO || "api";

const { criarApp } = require("../backend/src/app");

const app = criarApp();

// Atrás do proxy da Vercel: o IP real vem em X-Forwarded-For (limite de login).
app.set("trust proxy", true);

module.exports = (req, res) => {
    // As rotas do backend não têm o prefixo /api.
    if (req.url === "/api" || req.url.startsWith("/api/") || req.url.startsWith("/api?")) {
        const resto = req.url.slice(4);
        req.url = resto.startsWith("/") ? resto : `/${resto}`;
    }
    return app(req, res);
};
