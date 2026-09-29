/**
 * Agrupa todas as rotas da API em um único roteador.
 */
const { Router } = require("express");

const contasRoutes = require("./contas.routes");
const publicacoesRoutes = require("./publicacoes.routes");

const router = Router();

/** Verificação de saúde (health check). */
router.get("/", (req, res) => {
    res.json({
        mensagem: "Backend do IG Manager funcionando!",
        status: "online"
    });
});

router.use("/contas", contasRoutes);
router.use("/publicacoes", publicacoesRoutes);

module.exports = router;
