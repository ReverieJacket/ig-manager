/**
 * Rotas do app IG Manager Publicador (somente administrador, por token
 * `Authorization: Bearer`). O app não tem a chave do banco: tudo o que ele
 * lê e grava passa por aqui, com as regras de
 * `services/publicador-servidor.service.js`.
 *
 * POST /publicador/entrar              - { email, senha } -> { token } (rota pública, em index.js)
 * GET  /publicador/eu                  - confere o login
 * POST /publicador/inicio              - ligou: organiza interrompidas
 * POST /publicador/sinal | /desligar   - sinal de vida
 * GET  /publicador/vencidas            - agendadas cujo horário chegou
 * POST /publicador/publicacoes/:id/tratar     - decide e reserva
 * GET  /publicador/publicacoes/:id/imagem     - link temporário da imagem
 * POST /publicador/publicacoes/:id/resultado  - resultado do Instagram
 * POST /publicador/publicacoes/:id/comentarios - coleta de comentários
 * GET  /publicador/atrasadas | /proximas
 * GET  /publicador/tarefas             - pedidos pendentes
 * POST /publicador/tarefas/:id/pegar | /informar | /concluir
 * GET  /publicador/contas | /contas/:id
 * POST /publicador/contas/:id/sessao   - { salvaEm } (null = removida)
 */
const { Router } = require("express");

const { validarId } = require("../validators/publicacoes.validator");
const servidor = require("../services/publicador-servidor.service");

const router = Router();
const id = (req) => validarId(req.params.id, "ID inválido.");

router.get("/eu", (req, res) => {
    res.json({ sucesso: true, usuario: req.usuario });
});

router.post("/inicio", async (req, res) => {
    res.json(await servidor.iniciar({
        maquina: String(req.body?.maquina || "").slice(0, 100),
        versao: String(req.body?.versao || "").slice(0, 30)
    }));
});

router.post("/sinal", async (req, res) => {
    await servidor.sinalizar();
    res.json({ sucesso: true });
});

router.post("/desligar", async (req, res) => {
    await servidor.desligar();
    res.json({ sucesso: true });
});

router.get("/vencidas", async (req, res) => {
    res.json({ itens: await servidor.vencidas() });
});

router.post("/publicacoes/:id/tratar", async (req, res) => {
    const acordadoDesde = Number(req.body?.acordadoDesde);
    res.json(await servidor.tratar(id(req), Number.isFinite(acordadoDesde) ? acordadoDesde : Date.now()));
});

router.get("/publicacoes/:id/imagem", async (req, res) => {
    res.json(await servidor.linkDaImagem(id(req)));
});

router.post("/publicacoes/:id/resultado", async (req, res) => {
    res.json(await servidor.registrarResultado(id(req), req.body || {}));
});

router.post("/publicacoes/:id/comentarios", async (req, res) => {
    res.json(await servidor.salvarComentarios(id(req), req.body));
});

router.get("/atrasadas", async (req, res) => {
    res.json({ itens: await servidor.atrasadas() });
});

router.get("/proximas", async (req, res) => {
    res.json({ itens: await servidor.proximas() });
});

router.get("/tarefas", async (req, res) => {
    res.json({ itens: await servidor.tarefasPendentes() });
});

router.post("/tarefas/:id/pegar", async (req, res) => {
    res.json({ pedido: await servidor.pegarTarefa(id(req)) });
});

router.post("/tarefas/:id/informar", async (req, res) => {
    await servidor.informarTarefa(id(req), req.body?.mensagem);
    res.json({ sucesso: true });
});

router.post("/tarefas/:id/concluir", async (req, res) => {
    await servidor.concluirTarefa(id(req), req.body || {});
    res.json({ sucesso: true });
});

router.get("/contas", async (req, res) => {
    res.json({ itens: await servidor.contasAtivas() });
});

router.get("/contas/:id", async (req, res) => {
    res.json({ conta: await servidor.contaParaConectar(id(req)) });
});

router.post("/contas/:id/sessao", async (req, res) => {
    const salvaEm = req.body?.salvaEm;
    const valido = typeof salvaEm === "string" && !Number.isNaN(Date.parse(salvaEm));
    await servidor.definirSessao(id(req), valido ? new Date(salvaEm).toISOString() : null);
    res.json({ sucesso: true });
});

module.exports = router;
