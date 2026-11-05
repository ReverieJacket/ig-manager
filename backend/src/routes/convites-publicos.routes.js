/**
 * Rotas públicas do convite (o cliente abre o link sem estar logado).
 *
 * GET  /contas/convites/:token          - dados públicos do convite.
 * POST /contas/convites/:token/cadastro - conclui o cadastro da conta.
 *
 * Gerar convites (`POST /contas/convites`) continua restrito ao
 * administrador, em `contas.routes.js`.
 */
const { Router } = require("express");

const convitesService = require("../services/convites-contas.service");

const router = Router();

router.get("/:token", async (req, res) => {
    res.json(await convitesService.consultar(req.params.token));
});

router.post("/:token/cadastro", async (req, res) => {
    res.status(201).json(await convitesService.cadastrar(req.params.token, req.body));
});

module.exports = router;
