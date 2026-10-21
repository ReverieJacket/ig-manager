/**
 * Rotas de autenticação e do próprio usuário.
 *
 * POST  /auth/entrar       - { email, senha, manterConectado } -> grava o cookie.
 * POST  /auth/sair         - apaga o cookie.
 * GET   /auth/eu           - usuário da sessão atual (401 se não houver).
 * PATCH /auth/eu           - { nome } -> altera o próprio nome.
 * POST  /auth/trocar-senha - { senhaAtual, senhaNova } -> troca a própria senha,
 *                            encerra as outras sessões e renova o cookie.
 *
 * `/auth/eu` e `/auth/trocar-senha` funcionam mesmo com senha temporária:
 * é por elas que o usuário sai dessa situação.
 */
const { Router } = require("express");

const { ErroHttp } = require("../lib/erros");
const { gravarSessao, apagarSessao } = require("../lib/cookies");
const { autenticar, exigirSenhaDefinitiva } = require("../middlewares/autenticacao");
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

router.patch("/eu", autenticar, exigirSenhaDefinitiva, async (req, res) => {
    const usuario = await authService.atualizarNome(req.usuario.id, req.body?.nome);
    res.json({ sucesso: true, usuario });
});

router.post("/trocar-senha", autenticar, async (req, res) => {
    const resultado = await authService.trocarSenha({
        usuarioId: req.usuario.id,
        senhaAtual: req.body?.senhaAtual,
        senhaNova: req.body?.senhaNova,
        // Mantém o tipo de sessão escolhido no login.
        manterConectado: Boolean(req.sessao?.longa),
        // Primeiro acesso: acabou de entrar com a senha temporária.
        exigirSenhaAtual: !req.usuario.senhaTemporaria
    });

    gravarSessao(res, resultado.token, resultado.duracaoCookieMs);

    res.json({ sucesso: true, usuario: resultado.usuario });
});

module.exports = router;
