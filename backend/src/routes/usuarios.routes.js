/**
 * Gestão dos usuários de clientes pelo administrador (protegidas em
 * `routes/index.js`). Só atuam sobre usuários de perfil "cliente".
 *
 * PATCH /usuarios/:id                  - { nome?, email?, ativo? }.
 * POST  /usuarios/:id/redefinir-senha  - gera nova senha temporária.
 */
const { Router } = require("express");

const { validarId } = require("../validators/publicacoes.validator");
const clientesService = require("../services/clientes.service");

const router = Router();

router.patch("/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de usuário inválido.");
    res.json({ sucesso: true, usuario: await clientesService.atualizarUsuario(id, req.body) });
});

router.post("/:id/redefinir-senha", async (req, res) => {
    const id = validarId(req.params.id, "ID de usuário inválido.");
    res.json({ sucesso: true, ...(await clientesService.redefinirSenha(id)) });
});

module.exports = router;
