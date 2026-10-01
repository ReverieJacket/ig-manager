/**
 * Middlewares finais da aplicação: rota inexistente e tratamento de erros.
 *
 * No Express 5, erros lançados (ou promessas rejeitadas) dentro de
 * handlers assíncronos chegam aqui automaticamente, sem `try/catch`
 * nas rotas.
 */
const multer = require("multer");

const { ErroHttp, formatarErro } = require("../lib/erros");
/** Responde 404 para qualquer rota não registrada. */
function rotaNaoEncontrada(req, res) {
    res.status(404).json({
        sucesso: false,
        mensagem: "Rota não encontrada."
    });
}

/**
 * Converte qualquer erro em uma resposta JSON padronizada
 * `{ sucesso: false, mensagem }`.
 *
 * Só `ErroHttp` e erros do multer têm a mensagem exibida ao cliente;
 * os demais retornam texto genérico e o detalhe fica apenas no log,
 * para não vazar informações internas.
 */
// O Express identifica middleware de erro pela assinatura de 4 parâmetros.
// eslint-disable-next-line no-unused-vars
function tratarErros(erro, req, res, next) {
    if (res.headersSent) {
        return next(erro);
    }

    if (erro instanceof ErroHttp) {
        return res.status(erro.status).json({
            sucesso: false,
            mensagem: erro.message
        });
    }

    if (erro instanceof multer.MulterError) {
        return res.status(400).json({
            sucesso: false,
            mensagem: erro.message
        });
    }

    // Erros do leitor de corpo (body-parser): o problema é da requisição,
    // não do servidor, então a resposta é 4xx e não 500.
    if (erro.type === "entity.parse.failed") {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Corpo da requisição inválido: o JSON enviado está malformado."
        });
    }

    if (erro.type === "entity.too.large") {
        return res.status(413).json({
            sucesso: false,
            mensagem: "Corpo da requisição grande demais."
        });
    }

    // O pino-http (middleware de requisições) registra a resposta 500 e
    // anexa este erro, com pilha e id da requisição, em uma única linha.
    res.err = erro instanceof Error ? erro : new Error(formatarErro(erro));

    res.status(500).json({
        sucesso: false,
        mensagem: "Erro interno do servidor."
    });
}

module.exports = { rotaNaoEncontrada, tratarErros };
