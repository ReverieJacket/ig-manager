/**
 * Rotas de contas do Instagram.
 *
 * GET /contas - lista as contas ativas.
 */
const { Router } = require("express");

const contasService = require("../services/contas.service");

const router = Router();

router.get("/", async (req, res) => {
    res.json(await contasService.listarContasAtivas());
});

module.exports = router;
