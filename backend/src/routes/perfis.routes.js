/**
 * Perfis do Instagram (somente administrador; protegidas em `routes/index.js`).
 *
 * GET    /perfis          - todos os perfis ativos, com cliente e status
 *                           (tela Criar).
 * GET    /perfis/atencao  - perfis com sessão expirada (contador do menu e
 *                           aviso em Postagens).
 * PATCH  /perfis/:id      - { nome } -> renomeia o perfil.
 * DELETE /perfis/:id      - remove (recusado se houver publicações).
 *
 * Adicionar perfil e gerar link ficam em `/clientes/:id/...`; conectar e
 * desconectar continuam em `/contas/:id/conectar|conexao`.
 */
const { Router } = require("express");

const { validarId } = require("../validators/publicacoes.validator");
const perfisService = require("../services/perfis.service");

const router = Router();

router.get("/", async (req, res) => {
    res.json(await perfisService.listar());
});

router.get("/atencao", async (req, res) => {
    res.json(await perfisService.listarEmAtencao());
});

router.patch("/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de perfil inválido.");
    res.json({ sucesso: true, perfil: await perfisService.renomear(id, req.body?.nome) });
});

router.delete("/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de perfil inválido.");
    await perfisService.remover(id);
    res.json({ sucesso: true });
});

module.exports = router;
