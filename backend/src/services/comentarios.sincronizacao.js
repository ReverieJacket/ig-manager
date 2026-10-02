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
 *  - Para RESPOSTAS a exigência é maior: também é preciso que todas as
 *    respostas tenham sido expandidas ("Ver respostas"), senão uma resposta
 *    não aparecer só quer dizer que a lista dela não foi aberta.
 *  - Coleta vazia nunca marca remoções: é muito mais provável que a página
 *    não tenha carregado do que todos os comentários terem sido apagados.
 */

/**
 * @typedef {Object} ComentarioExistente
 * @property {number} id - Id da linha no banco.
 * @property {string} ig_comentario_id - Id do comentário no Instagram.
 * @property {string|null} [ig_comentario_pai_id] - Id do pai, se for resposta.
 * @property {string|null} removido_em - Quando foi marcado como removido.
 */

/**
 * @typedef {Object} PlanoSincronizacao
 * @property {Array<object>} gravar - Itens coletados a inserir/atualizar
 *   (upsert). Ao gravar, `removido_em` volta a `null`. Respostas levam
 *   `ig_comentario_pai_id` e `resposta_a_username` (o banco calcula
 *   `eh_resposta` sozinho).
 * @property {number[]} removerIds - Ids (do banco) a marcar como removidos.
 * @property {number} novos - Vistos pela primeira vez (comentários + respostas).
 * @property {number} novasRespostas - Dos `novos`, quantos são respostas.
 * @property {number} reaparecidos - Estavam marcados como removidos e voltaram.
 * @property {number} removidos - Quantos serão marcados como removidos.
 * @property {boolean} removocoesIgnoradas - `true` se a coleta foi incompleta
 *   ou vazia e, por isso, nenhuma remoção de comentário foi marcada.
 */

/**
 * Calcula o que gravar e o que marcar como removido.
 *
 * @param {ComentarioExistente[]} existentes - Linhas já guardadas da publicação.
 * @param {Array<{id: string, paiId?: (string|null), perfil: string,
 *   comentario: string, data: string, oculto: boolean, curtidas?: number,
 *   curtidasAproximado?: boolean}>} coletados - Saída da coleta
 *   (comentários e respostas).
 * @param {boolean} completa - A lista de comentários foi carregada até o fim.
 * @param {boolean} [respostasCompletas=completa] - Todas as respostas foram
 *   expandidas.
 * @returns {PlanoSincronizacao}
 */
function planejarSincronizacao(existentes, coletados, completa, respostasCompletas = completa) {
    const porIdInstagram = new Map(
        existentes.map((linha) => [linha.ig_comentario_id, linha])
    );

    // Duplicatas na mesma coleta (raro) ficam com a última ocorrência.
    const unicos = new Map(coletados.map((c) => [String(c.id), c]));

    // Autor de cada item coletado, para registrar "resposta a @fulano".
    const autorPorId = new Map(coletados.map((c) => [String(c.id), c.perfil]));

    let novos = 0;
    let novasRespostas = 0;
    let reaparecidos = 0;

    const gravar = [];

    for (const [idInstagram, coletado] of unicos) {
        const existente = porIdInstagram.get(idInstagram);

        if (!existente) {
            novos += 1;
            if (coletado.paiId) novasRespostas += 1;
        } else if (existente.removido_em) {
            reaparecidos += 1;
        }

        gravar.push({
            ig_comentario_id: idInstagram,
            ig_comentario_pai_id: coletado.paiId ?? null,
            resposta_a_username: coletado.paiId
                ? (autorPorId.get(String(coletado.paiId)) ?? null)
                : null,
            autor_username: coletado.perfil,
            texto: coletado.comentario,
            oculto: Boolean(coletado.oculto),
            publicado_em: coletado.data,
            curtidas: coletado.curtidas ?? 0,
            curtidas_aproximado: Boolean(coletado.curtidasAproximado),
            removido_em: null
        });
    }

    const vazia = unicos.size === 0;
    const podeRemoverPrincipais = completa && !vazia;
    const podeRemoverRespostas = completa && respostasCompletas && !vazia;

    const removerIds = existentes
        .filter((linha) => {
            if (linha.removido_em || unicos.has(linha.ig_comentario_id)) return false;

            return linha.ig_comentario_pai_id
                ? podeRemoverRespostas
                : podeRemoverPrincipais;
        })
        .map((linha) => linha.id);

    return {
        gravar,
        removerIds,
        novos,
        novasRespostas,
        reaparecidos,
        removidos: removerIds.length,
        removocoesIgnoradas: !podeRemoverPrincipais
    };
}

module.exports = { planejarSincronizacao };
