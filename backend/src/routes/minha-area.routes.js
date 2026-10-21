/**
 * Rotas da área do cliente (somente perfil "cliente"; protegidas em
 * `routes/index.js`). Tudo é filtrado pelo cliente DA SESSÃO
 * (`req.usuario.cliente`), nunca por um id vindo da requisição.
 *
 * GET  /minha-area/contas              - perfis do cliente, com status e
 *                                        `podeConectar`.
 * POST /minha-area/contas              - { nome, username } -> informa um perfil.
 * POST /minha-area/contas/:id/conectar - abre o Chromium para o login no
 *                                        Instagram (só perfis do próprio cliente).
 * GET  /minha-area/contas/:id/conexao  - andamento da conexão.
 * GET  /minha-area/publicacoes         - publicadas e programadas dos perfis.
 * GET  /minha-area/aprovacoes          - { pendentes, respondidas }.
 * POST /minha-area/aprovacoes/:id      - { decisao, categoria?, motivo? }
 *                                        (deferida | indeferida).
 * POST /minha-area/aprovacoes/deferir  - { ids } -> defere várias.
 *
 * Conectar pelo cliente depende de `CONEXAO_PELO_CLIENTE` (ver config).
 * Desconectar continua só com o administrador.
 */
const { Router } = require("express");

const { config } = require("../config/env");
const { ErroHttp } = require("../lib/erros");
const { validarId } = require("../validators/publicacoes.validator");
const contasRepository = require("../repositories/contas.repository");
const contasService = require("../services/contas.service");
const { contaComStatus } = require("../services/clientes.service");
const instagramAuth = require("../services/instagram-auth.service");
const publicacoesService = require("../services/publicacoes.service");
const aprovacoesService = require("../services/aprovacoes.service");

const router = Router();

router.get("/contas", async (req, res) => {
    const contas = await contasRepository.listarPorCliente(req.usuario.cliente.id);
    res.json(
        contas
            .filter((c) => c.ativo)
            .map((c) => ({ ...contaComStatus(c), podeConectar: config.conexaoPeloCliente }))
    );
});

/**
 * Perfil ativo do cliente da sessão. Perfil de outro cliente responde 404
 * (igual a inexistente, para não revelar ids de terceiros).
 */
async function perfilDoCliente(req) {
    if (!config.conexaoPeloCliente) {
        throw new ErroHttp(403, "A conexão do perfil é feita pela equipe. Entre em contato com ela.");
    }

    const id = validarId(req.params.id, "ID de perfil inválido.");
    const conta = await contasRepository.buscarPorId(id);

    if (!conta || !conta.ativo || Number(conta.cliente_id) !== Number(req.usuario.cliente.id)) {
        throw new ErroHttp(404, "Perfil não encontrado.");
    }

    return conta;
}

router.post("/contas/:id/conectar", async (req, res) => {
    const conta = await perfilDoCliente(req);
    res.json(await instagramAuth.iniciar(conta.id));
});

router.get("/contas/:id/conexao", async (req, res) => {
    const conta = await perfilDoCliente(req);
    res.json(await instagramAuth.consultar(conta.id));
});

router.post("/contas", async (req, res) => {
    const conta = await contasService.cadastrarContaDoCliente(req.usuario, {
        nome: req.body?.nome,
        username: req.body?.username
    });
    res.status(201).json({ sucesso: true, conta: { ...conta, conectada: false, status: "aguardando", podeConectar: config.conexaoPeloCliente } });
});

router.get("/publicacoes", async (req, res) => {
    res.json(await publicacoesService.listarPublicacoesDoCliente(req.usuario.cliente.id));
});

/* ------------------------------- aprovações ------------------------------ */

router.get("/aprovacoes", async (req, res) => {
    res.json(
        await aprovacoesService.listarDoCliente(
            req.usuario.cliente.id,
            publicacoesService.completarComConta
        )
    );
});

// Antes de "/aprovacoes/:id" para "deferir" não ser lido como id.
router.post("/aprovacoes/deferir", async (req, res) => {
    res.json({ sucesso: true, ...(await aprovacoesService.deferirLote(req.body?.ids, req.usuario)) });
});

router.post("/aprovacoes/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de publicação inválido.");
    const publicacao = await aprovacoesService.responder(id, req.body, req.usuario);
    res.json({ sucesso: true, aprovacao: publicacao.aprovacao, status: publicacao.status });
});

module.exports = router;
