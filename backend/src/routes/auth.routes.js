/**
 * Rotas de autenticação.
 *
 * POST /auth/entrar - { email, senha, manterConectado } -> grava o cookie.
 * POST /auth/sair   - apaga o cookie.
 * GET  /auth/eu     - usuário da sessão atual (401 se não houver).
 */
const { Router } = require("express");

const { ErroHttp } = require("../lib/erros");
const { gravarSessao, apagarSessao } = require("../lib/cookies");
const { autenticar } = require("../middlewares/autenticacao");
const { limitarLogin, registrarFalha, registrarSucesso } = require("../middlewares/limiteLogin");
const authService = require("../services/auth.service");

const router = Router();

router.post("/entrar", limitarLogin, async (req, res) => {
    let sessao;

    try {
        sessao = await authService.entrar({
            email: req.body?.email,
            senha: req.body?.senha,
            manterConectado: req.body?.manterConectado === true
        });
    } catch (erro) {
        if (erro instanceof ErroHttp && erro.status === 401) registrarFalha(req);
        throw erro;
    }

    registrarSucesso(req);
    gravarSessao(res, sessao.token, sessao.duracaoCookieMs);

    res.json({ sucesso: true, usuario: sessao.usuario });
});

router.post("/sair", (req, res) => {
    apagarSessao(res);
    res.json({ sucesso: true });
});

router.get("/eu", autenticar, (req, res) => {
    res.json({ sucesso: true, usuario: req.usuario });
});

module.exports = router;
