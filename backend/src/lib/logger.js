/**
 * Logger mínimo com escopo e timestamp.
 *
 * Substitui as funções `log` que existiam duplicadas em `server.js` e
 * `instagram.js`. Se o projeto crescer, pode ser trocado por uma
 * biblioteca (ex.: pino) mantendo a mesma interface.
 */

/**
 * Cria um logger identificado por um escopo (ex.: "Publicador").
 *
 * @param {string} escopo - Nome exibido entre colchetes em cada linha.
 * @returns {{ info: Function, erro: Function }} Funções `info` e `erro`,
 *   que aceitam uma mensagem e, opcionalmente, dados adicionais.
 */
function criarLogger(escopo) {
    const prefixo = () => `[${escopo}][${new Date().toISOString()}]`;

    return {
        info(mensagem, dados) {
            if (dados === undefined) {
                console.log(`${prefixo()} ${mensagem}`);
            } else {
                console.log(`${prefixo()} ${mensagem}`, dados);
            }
        },

        erro(mensagem, dados) {
            if (dados === undefined) {
                console.error(`${prefixo()} ${mensagem}`);
            } else {
                console.error(`${prefixo()} ${mensagem}`, dados);
            }
        }
    };
}

module.exports = { criarLogger };
