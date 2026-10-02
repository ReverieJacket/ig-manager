/**
 * Rotas de contas do Instagram, incluindo conexao local via navegador.
 */
const { Router } = require("express");
const contasService = require("../services/contas.service");
const instagramAuth = require("../services/instagram-auth.service");
const convitesService = require("../services/convites-contas.service");
const router = Router();

router.get("/", async (req,res) => res.json(await contasService.listarContasAtivas()));
router.post("/", async (req,res) => res.status(201).json(await contasService.cadastrarConta(req.body)));
router.post("/convites", async (req, res) => res.status(201).json(await convitesService.gerar({ cliente: req.body?.cliente, validadeHoras: req.body?.validadeHoras })));
router.get("/convites/:token", async (req, res) => res.json(await convitesService.consultar(req.params.token)));
router.post("/convites/:token/cadastro", async (req, res) => res.status(201).json(await convitesService.cadastrar(req.params.token, req.body)));
router.post("/:id/conectar", async (req,res) => res.json(await instagramAuth.iniciar(req.params.id)));
router.get("/:id/conexao", async (req,res) => res.json(await instagramAuth.consultar(req.params.id)));
router.delete("/:id/conexao", async (req,res) => res.json(await instagramAuth.desconectar(req.params.id)));

module.exports=router;
