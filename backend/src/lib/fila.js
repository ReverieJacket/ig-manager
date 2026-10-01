/**
 * Fila simples que executa uma tarefa assíncrona por vez, na ordem de chegada.
 *
 * Usada para a automação do Instagram: publicar e coletar comentários usam
 * navegador e sessão, e rodar dois ao mesmo tempo causaria conflito (e
 * chamaria a atenção do Instagram).
 */

/**
 * Cria uma fila independente.
 *
 * @returns {{executar: <T>(tarefa: () => Promise<T>) => Promise<T>}}
 *   `executar` agenda a tarefa e devolve uma promessa com o resultado (ou
 *   o erro) DELA; o erro de uma tarefa não impede as seguintes.
 */
function criarFila() {
    let cauda = Promise.resolve();

    return {
        executar(tarefa) {
            const resultado = cauda.then(tarefa);

            // A próxima tarefa espera esta terminar, com sucesso ou não.
            cauda = resultado.catch(() => {});

            return resultado;
        }
    };
}

/** Fila única da automação do Instagram (um navegador por vez). */
const filaAutomacao = criarFila();

module.exports = { criarFila, filaAutomacao };
