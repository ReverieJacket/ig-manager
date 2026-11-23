/**
 * Só a parte do navegador (sem banco): publicar e coletar comentários no
 * Instagram, neste computador, um de cada vez (fila da automação).
 *
 * Fica separado dos serviços para o app Publicador instalado — que não
 * tem a chave do banco — poder usá-lo.
 */
const { criarLogger } = require("../lib/logger");
const { filaAutomacao } = require("../lib/fila");

const log = criarLogger("Publicador");

/**
 * @param {{id: number, caminhoImagem: string, texto: string, mimetype?: string,
 *          conta: {id: number, username: string}}} dados
 * @returns {Promise<{sucesso: boolean, incerto?: boolean, mensagem?: string,
 *          codigoPost?: string, sessaoInvalida?: boolean}>}
 */
async function publicar({ id, caminhoImagem, texto, mimetype, conta }) {
    log.info(`Conta selecionada para publicação ${id}`, { id: conta.id, username: conta.username });

    const { publicarNoInstagram } = require("../automacao/instagram/publicar");
    const resultado = await filaAutomacao.executar(() =>
        publicarNoInstagram(caminhoImagem, texto, mimetype || undefined, Number(conta.id), conta.username)
    );

    log.info(`Resultado da automação da publicação ${id}`, resultado);
    return resultado;
}

/**
 * @param {{conta_id: number, ig_codigo: string}} publicacao
 */
async function coletarComentarios(publicacao) {
    const { coletarComentariosDoPost } = require("../automacao/instagram/coletar");
    return filaAutomacao.executar(() => coletarComentariosDoPost(publicacao.conta_id, publicacao.ig_codigo));
}

module.exports = { publicar, coletarComentarios };
