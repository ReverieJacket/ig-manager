/**
 * Agrupa todas as rotas da API em um único roteador.
 *
 * Ordem importa: primeiro as rotas públicas; depois cada grupo protegido
 * declara quem pode usá-lo. Quem está com senha temporária só acessa
 * `/auth/*` até criar a própria senha.
 */
const { Router } = require("express");

const authRoutes = require("./auth.routes");
const convitesPublicosRoutes = require("./convites-publicos.routes");
const contasRoutes = require("./contas.routes");
const publicacoesRoutes = require("./publicacoes.routes");
const clientesRoutes = require("./clientes.routes");
const usuariosRoutes = require("./usuarios.routes");
const minhaAreaRoutes = require("./minha-area.routes");
const perfisRoutes = require("./perfis.routes");
const {
    autenticar,
    exigirSenhaDefinitiva,
    exigirPerfil
} = require("../middlewares/autenticacao");
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

const somenteAdmin = [autenticar, exigirSenhaDefinitiva, exigirPerfil(PERFIS.ADMIN)];

router.use("/contas", ...somenteAdmin, contasRoutes);
router.use("/publicacoes", ...somenteAdmin, publicacoesRoutes);
router.use("/clientes", ...somenteAdmin, clientesRoutes);
router.use("/usuarios", ...somenteAdmin, usuariosRoutes);
router.use("/perfis", ...somenteAdmin, perfisRoutes);

/* --------------------------- Rotas do cliente ---------------------------- */

const somenteCliente = [autenticar, exigirSenhaDefinitiva, exigirPerfil(PERFIS.CLIENTE)];

router.use("/minha-area", ...somenteCliente, minhaAreaRoutes);

module.exports = router;
