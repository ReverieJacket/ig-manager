/**
 * Validação de entrada das rotas de publicações.
 *
 * Converte dados brutos da requisição (strings de formulário) em valores
 * tipados, ou lança `ErroHttp` 400 com uma mensagem clara.
 */
const { ErroHttp } = require("../lib/erros");
const { FORMATO_CODIGO_POST } = require("../automacao/instagram/seletores");

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

/**
 * Valida a paginação de uma listagem (`?pagina=1&limite=50`).
 *
 * @param {object} query - `req.query`.
 * @returns {{pagina: number, limite: number, incluirRemovidos: boolean}}
 * @throws {ErroHttp} 400 para valores fora do intervalo.
 */
function validarPaginacao(query) {
    const pagina = query.pagina === undefined ? 1 : Number(query.pagina);
    const limite = query.limite === undefined ? 50 : Number(query.limite);

    if (!Number.isInteger(pagina) || pagina < 1) {
        throw new ErroHttp(400, "Página inválida.");
    }

    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
        throw new ErroHttp(400, "O limite deve estar entre 1 e 100.");
    }

    return {
        pagina,
        limite,
        incluirRemovidos: query.incluirRemovidos === "true"
    };
}

/**
 * Extrai o código curto de um post a partir do código em si ou de uma URL
 * (`https://www.instagram.com/p/<codigo>/`, também `/reel/<codigo>/`).
 *
 * @param {object} corpo - `req.body` com `codigo` ou `url`.
 * @returns {string} Código validado.
 * @throws {ErroHttp} 400 se não for possível obter um código válido.
 */
function validarCodigoPost(corpo) {
    const bruto = String(corpo?.codigo || corpo?.url || "").trim();
    const daUrl = bruto.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel)\/([^/?#]+)/i);
    const codigo = daUrl ? daUrl[1] : bruto;

    if (!FORMATO_CODIGO_POST.test(codigo)) {
        throw new ErroHttp(400, "Informe o código ou a URL do post no Instagram.");
    }

    return codigo;
}

module.exports = {
    validarId,
    validarNovaPublicacao,
    validarPaginacao,
    validarCodigoPost
};
