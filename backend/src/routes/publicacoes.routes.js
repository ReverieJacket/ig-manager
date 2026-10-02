/**
 * Rotas de publicações.
 *
 * GET  /publicacoes     - lista publicações com dados da conta.
 * POST /publicacoes     - cria publicação imediata ou agendada
 *                         (multipart/form-data: imagem, texto, dataHora, conta_id).
 * GET  /publicacoes/:id - consulta uma publicação.
 * GET  /publicacoes/:id/comentarios - comentários (?pagina, ?limite, ?incluirRemovidos).
 * POST /publicacoes/:id/comentarios/coletar - coleta agora no Instagram (demora).
 * PATCH /publicacoes/:id/instagram - define o código/URL do post no Instagram.
 *
 * As rotas apenas traduzem HTTP <-> serviço: validam a entrada e
 * escolhem o status da resposta.
 */
const { Router } = require("express");

const { uploadImagem } = require("../middlewares/upload");
const {
    validarId,
    validarNovaPublicacao,
    validarPaginacao,
    validarCodigoPost
} = require("../validators/publicacoes.validator");
const publicacoesService = require("../services/publicacoes.service");
const comentariosService = require("../services/comentarios.service");

const router = Router();

router.get("/", async (req, res) => {
    res.json(await publicacoesService.listarPublicacoes());
});

router.post("/", uploadImagem, async (req, res) => {
    const entrada = validarNovaPublicacao(req.body, req.file);
    const { agendada, publicacao, resultado } =
        await publicacoesService.criarPublicacao(entrada);

    if (agendada) {
        return res.status(201).json({
            sucesso: true,
            agendada: true,
            id: publicacao.id,
            mensagem:
                `Publicação agendada para ${entrada.dataHora.toLocaleString("pt-BR")}.`
        });
    }

    if (resultado.sucesso) {
        return res.status(200).json({
            sucesso: true,
            id: publicacao.id,
            mensagem: "Publicação realizada com sucesso."
        });
    }

    // 502: o servidor funcionou, mas a automação (serviço externo) falhou.
    res.status(502).json({
        sucesso: false,
        id: publicacao.id,
        resultadoIncerto: Boolean(resultado.resultadoIncerto),
        mensagem:
            resultado.mensagem || "A automação não confirmou a publicação."
    });
});

router.get("/:id", async (req, res) => {
    const id = validarId(req.params.id, "ID de publicação inválido.");

    res.json(await publicacoesService.buscarPublicacao(id));
});

router.get("/:id/comentarios", async (req, res) => {
    const id = validarId(req.params.id, "ID de publicação inválido.");

    res.json(
        await comentariosService.listarComentarios(id, validarPaginacao(req.query))
    );
});

router.post("/:id/comentarios/coletar", async (req, res) => {
    const id = validarId(req.params.id, "ID de publicação inválido.");

    res.json({
        sucesso: true,
        ...(await comentariosService.coletarComentarios(id))
    });
});

router.patch("/:id/instagram", async (req, res) => {
    const id = validarId(req.params.id, "ID de publicação inválido.");
    const codigo = validarCodigoPost(req.body);

    await comentariosService.definirCodigoPost(id, codigo);

    res.json({ sucesso: true, ig_codigo: codigo });
});

module.exports = router;
