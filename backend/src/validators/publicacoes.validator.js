/**
 * Validação de entrada das rotas de publicações.
 *
 * Converte dados brutos da requisição (strings de formulário) em valores
 * tipados, ou lança `ErroHttp` 400 com uma mensagem clara.
 */
const { ErroHttp } = require("../lib/erros");

/**
 * Converte um identificador recebido (rota ou formulário) em inteiro positivo.
 *
 * @param {unknown} valor - Valor bruto.
 * @param {string} mensagem - Mensagem usada se o valor for inválido.
 * @returns {number}
 * @throws {ErroHttp} 400 se não for um inteiro positivo.
 */
function validarId(valor, mensagem) {
    const id = Number(valor);

    if (!Number.isInteger(id) || id <= 0) {
        throw new ErroHttp(400, mensagem);
    }

    return id;
}

/**
 * Valida o corpo do `POST /publicacoes` (multipart/form-data).
 *
 * @param {object} corpo - `req.body` preenchido pelo multer.
 * @param {Express.Multer.File|undefined} arquivo - `req.file`.
 * @returns {{arquivo: Express.Multer.File, texto: string,
 *            contaId: number, dataHora: Date}}
 * @throws {ErroHttp} 400 para qualquer campo ausente ou inválido.
 */
function validarNovaPublicacao(corpo, arquivo) {
    if (!arquivo) {
        throw new ErroHttp(400, "Nenhuma imagem foi enviada.");
    }

    const texto = String(corpo.texto || "").trim();

    if (!texto) {
        throw new ErroHttp(400, "A legenda não foi informada.");
    }

    const contaId = validarId(
        corpo.contaId || corpo.conta_id,
        "Selecione uma conta do Instagram válida."
    );

    if (!corpo.dataHora) {
        throw new ErroHttp(400, "Informe a data e hora da publicação.");
    }

    const dataHora = new Date(corpo.dataHora);

    if (Number.isNaN(dataHora.getTime())) {
        throw new ErroHttp(400, "Data e hora inválidas.");
    }

    return { arquivo, texto, contaId, dataHora };
}

module.exports = { validarId, validarNovaPublicacao };
