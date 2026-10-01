/**
 * Regra de sincronização dos comentários coletados com os já guardados.
 *
 * Função PURA (sem banco, sem relógio, sem rede): recebe o que existe e
 * o que foi coletado e diz o que fazer. Isso a torna fácil de testar.
 *
 * Princípios:
 *  - Nunca se apaga nada: comentário que sumiu é apenas marcado
 *    (`removido_em`), preservando o histórico.
 *  - "Não apareceu na coleta" só vira "removido" quando a coleta foi
 *    COMPLETA. Coleta parcial (comentários não carregados) não prova nada.
 *  - Coleta vazia nunca marca remoções: é muito mais provável que a página
 *    não tenha carregado do que todos os comentários terem sido apagados.
 */

/**
 * @typedef {Object} ComentarioExistente
 * @property {number} id - Id da linha no banco.
 * @property {string} ig_comentario_id - Id do comentário no Instagram.
 * @property {string|null} removido_em - Quando foi marcado como removido.
 */

/**
 * @typedef {Object} PlanoSincronizacao
 * @property {Array<object>} gravar - Comentários coletados a inserir/atualizar
 *   (upsert). Ao gravar, `removido_em` volta a `null`.
 * @property {number[]} removerIds - Ids (do banco) a marcar como removidos.
 * @property {number} novos - Comentários vistos pela primeira vez.
 * @property {number} reaparecidos - Estavam marcados como removidos e voltaram.
 * @property {number} removidos - Quantos serão marcados como removidos.
 * @property {boolean} removocoesIgnoradas - `true` se a coleta foi incompleta
 *   ou vazia e, por isso, nenhuma remoção foi marcada.
 */

/**
 * Calcula o que gravar e o que marcar como removido.
 *
 * @param {ComentarioExistente[]} existentes - Linhas já guardadas da publicação.
 * @param {Array<{id: string, perfil: string, comentario: string,
 *   data: string, oculto: boolean}>} coletados - Saída da coleta.
 * @param {boolean} completa - A coleta carregou a lista até o fim.
 * @returns {PlanoSincronizacao}
 */
function planejarSincronizacao(existentes, coletados, completa) {
    const porIdInstagram = new Map(
        existentes.map((linha) => [linha.ig_comentario_id, linha])
    );

    // Duplicatas na mesma coleta (raro) ficam com a última ocorrência.
    const unicos = new Map(coletados.map((c) => [String(c.id), c]));

    let novos = 0;
    let reaparecidos = 0;

    const gravar = [];

    for (const [idInstagram, coletado] of unicos) {
        const existente = porIdInstagram.get(idInstagram);

        if (!existente) novos += 1;
        else if (existente.removido_em) reaparecidos += 1;

        gravar.push({
            ig_comentario_id: idInstagram,
            autor_username: coletado.perfil,
            texto: coletado.comentario,
            oculto: Boolean(coletado.oculto),
            publicado_em: coletado.data,
            removido_em: null
        });
    }

    const podeMarcarRemocoes = completa && unicos.size > 0;

    const removerIds = podeMarcarRemocoes
        ? existentes
            .filter((linha) => !linha.removido_em && !unicos.has(linha.ig_comentario_id))
            .map((linha) => linha.id)
        : [];

    return {
        gravar,
        removerIds,
        novos,
        reaparecidos,
        removidos: removerIds.length,
        removocoesIgnoradas: !podeMarcarRemocoes
    };
}

module.exports = { planejarSincronizacao };
