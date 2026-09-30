/**
 * Rotas de contas do Instagram.
 * GET /contas lista contas ativas; POST /contas cadastra uma conta manualmente.
 */
const { Router } = require("express");
const contasService = require("../services/contas.service");

const router = Router();

router.get("/", async (req, res) => {
    res.json(await contasService.listarContasAtivas());
});

router.post("/", async (req, res) => {
    const conta = await contasService.cadastrarConta(req.body);
    res.status(201).json(conta);
});

module.exports = router;
