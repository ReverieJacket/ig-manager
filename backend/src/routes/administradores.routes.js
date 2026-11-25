/**
 * Administradores do mesmo espaço (protegidas em `routes/index.js`).
 *
 * GET   /administradores                      - lista os administradores do espaço.
 * POST  /administradores                      - { nome, email } → cria com senha provisória.
 * PATCH /administradores/:id                  - { nome?, email?, ativo? }.
 * POST  /administradores/:id/redefinir-senha  - nova senha provisória.
 */
const { Router } = require("express");

const { validarId } = require("../validators/publicacoes.validator");
const administradoresService = require("../services/administradores.service");

const router = Router();

router.get("/", async (req, res) => {
    res.json({ sucesso: true, administradores: await administradoresService.listar() });
});

router.post("/", async (req, res) => {
    res.status(201).json({ sucesso: true, ...(await administradoresService.criar(req.body)) });
});

router.patch("/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de administrador inválido.");
    res.json({
        sucesso: true,
        usuario: await administradoresService.atualizar(id, req.body, req.usuario.id)
    });
});

router.post("/:id/redefinir-senha", async (req, res) => {
    const id = validarId(req.params.id, "ID de administrador inválido.");
    res.json({ sucesso: true, ...(await administradoresService.redefinirSenha(id, req.usuario.id)) });
});

module.exports = router;
