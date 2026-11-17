/**
 * Perfis do Instagram (somente administrador; protegidas em `routes/index.js`).
 *
 * GET    /perfis          - todos os perfis ativos, com cliente e status
 *                           (tela Criar).
 * GET    /perfis/atencao  - perfis com sessão expirada (contador do menu e
 *                           aviso em Postagens).
 * GET    /perfis/config   - { conexaoNoServidor, modo, publicador }: se o
 *                           "Conectar" abre o Chromium aqui, por arquivo ou
 *                           no Publicador, e se o Publicador está ligado.
 * POST   /perfis/:id/sessao - multipart `arquivo`: envia o conta-<id>.json
 *                           gerado pelo login:instagram (servidor sem tela).
 * PATCH  /perfis/:id      - { nome } -> renomeia o perfil.
 * DELETE /perfis/:id      - remove (recusado se houver publicações).
 *
 * Adicionar perfil e gerar link ficam em `/clientes/:id/...`; conectar e
 * desconectar continuam em `/contas/:id/conectar|conexao`.
 */
const { Router } = require("express");

const { validarId } = require("../validators/publicacoes.validator");
const perfisService = require("../services/perfis.service");
const sessaoImportada = require("../services/sessao-importada.service");
const { uploadSessao } = require("../middlewares/upload");
const { ErroHttp } = require("../lib/erros");
const { config, MODOS } = require("../config/env");
const publicadorEstado = require("../services/publicador-estado.service");

const router = Router();

router.get("/", async (req, res) => {
    res.json(await perfisService.listar());
});

router.get("/atencao", async (req, res) => {
    res.json(await perfisService.listarEmAtencao());
});

router.get("/config", async (req, res) => {
    res.json({
        conexaoNoServidor: config.conexaoNoServidor,
        // Na Vercel a sessão fica no Publicador: "Enviar sessão" não se aplica.
        envioDeSessao: config.modo !== MODOS.API,
        modo: config.modo,
        publicador: await publicadorEstado.consultar()
    });
});

router.post("/:id/sessao", uploadSessao, async (req, res) => {
    const id = validarId(req.params.id, "ID de perfil inválido.");
    if (config.modo === MODOS.API) {
        throw new ErroHttp(409, "No site da Vercel a sessão fica no Publicador: use \"Conectar\".");
    }
    if (!req.file) throw new ErroHttp(400, "Escolha o arquivo de sessão (conta-<id>.json).");
    res.json({ sucesso: true, ...(await sessaoImportada.importar(id, req.file.buffer)) });
});

router.patch("/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de perfil inválido.");
    res.json({ sucesso: true, perfil: await perfisService.renomear(id, req.body?.nome) });
});

router.delete("/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de perfil inválido.");
    await perfisService.remover(id);
    res.json({ sucesso: true });
});

module.exports = router;
