/**
 * Erros da aplicação e utilitários de tratamento.
 */

/**
 * Erro que já carrega o status HTTP e uma mensagem segura para o cliente.
 * O middleware de erros (`middlewares/erros.js`) o converte em resposta JSON.
 */
class ErroHttp extends Error {
    /**
     * @param {number} status - Código HTTP (ex.: 400, 404).
     * @param {string} mensagem - Texto exibível ao usuário final.
     */
    constructor(status, mensagem) {
        super(mensagem);
        this.name = "ErroHttp";
        this.status = status;
    }
}

/**
 * Extrai uma mensagem legível de qualquer valor lançado.
 *
 * O supabase-js devolve erros que são objetos simples (não `Error`),
 * por isso não basta usar `instanceof Error`.
 *
 * @param {unknown} erro - Valor capturado em um `catch`.
 * @returns {string} Mensagem de erro.
 */
function formatarErro(erro) {
    if (!erro) return "Erro não especificado.";

    return erro.message || String(erro);
}

module.exports = { ErroHttp, formatarErro };
