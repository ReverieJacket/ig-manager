/**
 * Rotas de publicações.
 *
 * GET  /publicacoes     - lista publicações com dados da conta.
 * POST /publicacoes     - cria publicação imediata ou agendada
 *                         (multipart/form-data: imagem, texto, dataHora, conta_id).
 * GET  /publicacoes/:id - consulta uma publicação.
 *
 * As rotas apenas traduzem HTTP <-> serviço: validam a entrada e
 * escolhem o status da resposta.
 */
const { Router } = require("express");

const { uploadImagem } = require("../middlewares/upload");
const {
    validarId,
    validarNovaPublicacao
} = require("../validators/publicacoes.validator");
const publicacoesService = require("../services/publicacoes.service");

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

module.exports = router;
