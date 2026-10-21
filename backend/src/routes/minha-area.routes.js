/**
 * Rotas da área do cliente (somente perfil "cliente"; protegidas em
 * `routes/index.js`). Tudo é filtrado pelo cliente DA SESSÃO
 * (`req.usuario.cliente`), nunca por um id vindo da requisição.
 *
 * GET  /minha-area/contas      - contas do Instagram do cliente, com status.
 * POST /minha-area/contas      - { nome, username } -> informa uma conta nova.
 * GET  /minha-area/publicacoes - publicadas e programadas das contas do cliente.
 */
const { Router } = require("express");

const contasRepository = require("../repositories/contas.repository");
const contasService = require("../services/contas.service");
const { contaComStatus } = require("../services/clientes.service");
const publicacoesService = require("../services/publicacoes.service");

const router = Router();

router.get("/contas", async (req, res) => {
    const contas = await contasRepository.listarPorCliente(req.usuario.cliente.id);
    res.json(contas.filter((c) => c.ativo).map(contaComStatus));
});

router.post("/contas", async (req, res) => {
    const conta = await contasService.cadastrarContaDoCliente(req.usuario, {
        nome: req.body?.nome,
        username: req.body?.username
    });
    res.status(201).json({ sucesso: true, conta: { ...conta, conectada: false, status: "aguardando" } });
});

router.get("/publicacoes", async (req, res) => {
    res.json(await publicacoesService.listarPublicacoesDoCliente(req.usuario.cliente.id));
});

module.exports = router;
