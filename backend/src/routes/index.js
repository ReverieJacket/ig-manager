/**
 * Agrupa todas as rotas da API em um único roteador.
 *
 * Ordem importa: primeiro as rotas públicas; depois `autenticar` +
 * `exigirPerfil("admin")` protegem tudo o que vem abaixo.
 */
const { Router } = require("express");

const authRoutes = require("./auth.routes");
const convitesPublicosRoutes = require("./convites-publicos.routes");
const contasRoutes = require("./contas.routes");
const publicacoesRoutes = require("./publicacoes.routes");
const { autenticar, exigirPerfil } = require("../middlewares/autenticacao");
const { PERFIS } = require("../services/auth.service");

const router = Router();

/* ----------------------------- Rotas públicas ---------------------------- */

/** Verificação de saúde (health check). */
router.get("/", (req, res) => {
    res.json({
        mensagem: "Backend do IG Manager funcionando!",
        status: "online"
    });
});

router.use("/auth", authRoutes);

// Link de convite aberto pelo cliente (ainda sem login).
router.use("/contas/convites", convitesPublicosRoutes);

/* ------------------------- Rotas do administrador ------------------------ */

const somenteAdmin = [autenticar, exigirPerfil(PERFIS.ADMIN)];

router.use("/contas", ...somenteAdmin, contasRoutes);
router.use("/publicacoes", ...somenteAdmin, publicacoesRoutes);

module.exports = router;
