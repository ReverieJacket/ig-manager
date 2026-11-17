/**
 * Pedidos feitos ao Publicador (somente administrador).
 *
 * GET /tarefas/:id - andamento de um pedido (ex.: coleta de comentários
 *                    pedida pelo site na Vercel).
 */
const { Router } = require("express");

const { validarId } = require("../validators/publicacoes.validator");
const automacao = require("../services/automacao.service");

const router = Router();

router.get("/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de pedido inválido.");
    res.json(await automacao.consultarTarefa(id));
});

module.exports = router;
