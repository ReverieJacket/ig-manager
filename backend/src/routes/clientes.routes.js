/**
 * Rotas da tela "Clientes" (somente administrador; protegidas em
 * `routes/index.js`).
 *
 * GET   /clientes               - lista com contadores.
 * POST  /clientes               - { nome, usuario: { nome, email } } -> cria
 *                                 cliente + 1º usuário; devolve a senha temporária.
 * GET   /clientes/:id           - detalhe: usuários e contas do Instagram.
 * PATCH /clientes/:id           - { nome?, ativo? }.
 * DELETE /clientes/:id          - exclui de vez (bloqueado se houver publicações).
 * POST  /clientes/:id/usuarios  - { nome, email } -> novo usuário (senha temporária).
 * POST  /clientes/:id/perfis    - { nome, username } -> admin adiciona um perfil.
 * POST  /clientes/:id/link      - { validadeHoras } -> link para o cliente informar o @.
 */
const { Router } = require("express");

const { validarId } = require("../validators/publicacoes.validator");
const clientesService = require("../services/clientes.service");
const perfisService = require("../services/perfis.service");
const convitesService = require("../services/convites-contas.service");

const router = Router();

router.get("/", async (req, res) => {
    res.json(await clientesService.listar());
});

router.post("/", async (req, res) => {
    res.status(201).json({ sucesso: true, ...(await clientesService.criar(req.body)) });
});

router.get("/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de cliente inválido.");
    res.json(await clientesService.detalhar(id));
});

router.patch("/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de cliente inválido.");
    res.json({ sucesso: true, cliente: await clientesService.atualizar(id, req.body) });
});

router.delete("/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de cliente inválido.");
    res.json({ sucesso: true, ...(await clientesService.excluir(id)) });
});

router.post("/:id/perfis", async (req, res) => {
    const id = validarId(req.params.id, "ID de cliente inválido.");
    const perfil = await perfisService.adicionar(id, req.usuario, {
        nome: req.body?.nome,
        username: req.body?.username
    });
    res.status(201).json({ sucesso: true, perfil });
});

router.post("/:id/link", async (req, res) => {
    const id = validarId(req.params.id, "ID de cliente inválido.");
    const convite = await convitesService.gerarParaCliente(id, req.body?.validadeHoras);
    res.status(201).json({ sucesso: true, url: convite.url, expiraEm: convite.expires_at });
});

router.post("/:id/usuarios", async (req, res) => {
    const id = validarId(req.params.id, "ID de cliente inválido.");
    res.status(201).json({ sucesso: true, ...(await clientesService.adicionarUsuario(id, req.body)) });
});

module.exports = router;
