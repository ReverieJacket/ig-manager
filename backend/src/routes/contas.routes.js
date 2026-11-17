/**
 * Rotas de contas do Instagram, incluindo conexao local via navegador.
 * Exclusivas do administrador (protegidas em `routes/index.js`). As rotas
 * públicas do convite ficam em `convites-publicos.routes.js`.
 */
const { Router } = require("express");
const contasService = require("../services/contas.service");
const automacao = require("../services/automacao.service");
const convitesService = require("../services/convites-contas.service");
const router = Router();

router.get("/", async (req,res) => res.json(await contasService.listarContasAtivas()));
router.post("/", async (req,res) => res.status(201).json(await contasService.cadastrarConta(req.body)));
router.post("/convites", async (req, res) => res.status(201).json(await convitesService.gerar({ cliente: req.body?.cliente, validadeHoras: req.body?.validadeHoras })));
router.post("/:id/conectar", async (req,res) => res.json(await automacao.conectar(req.params.id)));
router.get("/:id/conexao", async (req,res) => res.json(await automacao.consultarConexao(req.params.id)));
router.delete("/:id/conexao", async (req,res) => res.json(await automacao.desconectar(req.params.id)));

module.exports=router;
