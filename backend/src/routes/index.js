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
const tarefasRoutes = require("./tarefas.routes");
const publicadorRoutes = require("./publicador.routes");
const { limitarLogin, registrarFalha, registrarSucesso } = require("../middlewares/limiteLogin");
const { ErroHttp } = require("../lib/erros");
const {
    autenticar,
    exigirSenhaDefinitiva,
    exigirPerfil
} = require("../middlewares/autenticacao");
const authService = require("../services/auth.service");
const { PERFIS } = authService;

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

// Login do app IG Manager Publicador (devolve um token em vez de cookie).
router.post("/publicador/entrar", limitarLogin, async (req, res) => {
    let sessao;
    try {
        sessao = await authService.entrarApp({ email: req.body?.email, senha: req.body?.senha });
    } catch (erro) {
        if (erro instanceof ErroHttp && erro.status === 401) registrarFalha(req);
        throw erro;
    }
    registrarSucesso(req);
    res.json({ sucesso: true, token: sessao.token, usuario: sessao.usuario });
});

// Link de convite aberto pelo cliente (ainda sem login).
router.use("/contas/convites", convitesPublicosRoutes);

/* ------------------------- Rotas do administrador ------------------------ */

const somenteAdmin = [autenticar, exigirSenhaDefinitiva, exigirPerfil(PERFIS.ADMIN)];

router.use("/contas", ...somenteAdmin, contasRoutes);
router.use("/publicacoes", ...somenteAdmin, publicacoesRoutes);
router.use("/clientes", ...somenteAdmin, clientesRoutes);
router.use("/usuarios", ...somenteAdmin, usuariosRoutes);
router.use("/perfis", ...somenteAdmin, perfisRoutes);
router.use("/tarefas", ...somenteAdmin, tarefasRoutes);
router.use("/publicador", ...somenteAdmin, publicadorRoutes);

/* --------------------------- Rotas do cliente ---------------------------- */

const somenteCliente = [autenticar, exigirSenhaDefinitiva, exigirPerfil(PERFIS.CLIENTE)];

router.use("/minha-area", ...somenteCliente, minhaAreaRoutes);

module.exports = router;
