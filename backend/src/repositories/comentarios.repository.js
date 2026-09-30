/**
 * Repositório de comentários (tabela `comentarios_instagram`).
 *
 * Camada de acesso a dados: só conhece o Supabase. Todas as funções
 * lançam o erro do Supabase em caso de falha.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "comentarios_instagram";

/** Quantas linhas por requisição ao gravar (evita corpos gigantes). */
const TAMANHO_LOTE = 500;

/**
 * Lista TODOS os comentários já guardados de uma publicação, apenas com o
 * necessário para comparar com uma nova coleta (inclui os removidos).
 *
 * @param {number} publicacaoId
 * @returns {Promise<Array<{id: number, ig_comentario_id: string, removido_em: (string|null)}>>}
 */
async function listarParaSincronizar(publicacaoId) {
    const linhas = [];
    const passo = 1000;

    // O Supabase limita cada resposta (1000 linhas por padrão): pagina-se.
    for (let inicio = 0; ; inicio += passo) {
        const { data, error } = await supabase
            .from(TABELA)
            .select("id, ig_comentario_id, removido_em")
            .eq("publicacao_id", publicacaoId)
            .order("id", { ascending: true })
            .range(inicio, inicio + passo - 1);

        if (error) throw error;

        linhas.push(...data);

        if (data.length < passo) break;
    }

    return linhas;
}

/**
 * Insere ou atualiza comentários (chave: publicação + id do Instagram).
 * Colunas não informadas mantêm o valor atual; em linhas novas valem os
 * padrões do banco (ex.: `primeira_vez_visto_em`).
 *
 * @param {Array<object>} linhas - Já com `publicacao_id` e `conta_id`.
 * @returns {Promise<void>}
 */
async function gravarLote(linhas) {
    for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
        const { error } = await supabase
            .from(TABELA)
            .upsert(linhas.slice(i, i + TAMANHO_LOTE), {
                onConflict: "publicacao_id,ig_comentario_id"
            });

        if (error) throw error;
    }
}

/**
 * Marca comentários como removidos (não apaga).
 *
 * @param {number[]} ids - Ids das linhas no banco.
 * @param {string} quando - Instante ISO da detecção.
 * @returns {Promise<void>}
 */
async function marcarRemovidos(ids, quando) {
    for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
        const { error } = await supabase
            .from(TABELA)
            .update({ removido_em: quando })
            .in("id", ids.slice(i, i + TAMANHO_LOTE));

        if (error) throw error;
    }
}

/**
 * Conta os comentários ativos (não removidos) de uma publicação.
 *
 * @param {number} publicacaoId
 * @returns {Promise<number>}
 */
async function contarAtivos(publicacaoId) {
    const { count, error } = await supabase
        .from(TABELA)
        .select("id", { count: "exact", head: true })
        .eq("publicacao_id", publicacaoId)
        .is("removido_em", null);

    if (error) throw error;

    return count || 0;
}

/**
 * Lista comentários de uma publicação, do mais recente ao mais antigo.
 *
 * @param {number} publicacaoId
 * @param {{limite: number, deslocamento: number, incluirRemovidos: boolean}} opcoes
 * @returns {Promise<{itens: object[], total: number}>} `total` considera o
 *   mesmo filtro, para paginação.
 */
async function listarPorPublicacao(publicacaoId, { limite, deslocamento, incluirRemovidos }) {
    let consulta = supabase
        .from(TABELA)
        .select(
            "id, autor_username, texto, publicado_em, oculto, removido_em",
            { count: "exact" }
        )
        .eq("publicacao_id", publicacaoId)
        .order("publicado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(deslocamento, deslocamento + limite - 1);

    if (!incluirRemovidos) consulta = consulta.is("removido_em", null);

    const { data, count, error } = await consulta;

    if (error) throw error;

    return { itens: data || [], total: count || 0 };
}

module.exports = {
    listarParaSincronizar,
    gravarLote,
    marcarRemovidos,
    contarAtivos,
    listarPorPublicacao
};
