/**
 * Repositório de comentários (tabela `comentarios_instagram`).
 *
 * Camada de acesso a dados: só conhece o Supabase. Todas as funções
 * lançam o erro do Supabase em caso de falha.
 *
 * Respostas a comentários e curtidas de cada comentário dependem das colunas
 * criadas pela migração 003. `colunasDeRespostasDisponiveis` permite ao
 * serviço funcionar (sem esses dados) enquanto a migração não foi executada.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "comentarios_instagram";

/** Quantas linhas por requisição ao gravar (evita corpos gigantes). */
const TAMANHO_LOTE = 500;

const COLUNAS_BASE = "id, autor_username, texto, publicado_em, oculto, removido_em";
const COLUNAS_COM_RESPOSTAS = `${COLUNAS_BASE}, ig_comentario_id, ig_comentario_pai_id, eh_resposta, resposta_a_username, curtidas, curtidas_aproximado`;

/**
 * Indica se o erro do Supabase significa "coluna inexistente" (migração
 * pendente): 42703 no Postgres, PGRST204 no PostgREST.
 *
 * @param {{code?: string, message?: string}} erro
 * @returns {boolean}
 */
function colunaAusente(erro) {
    return (
        erro?.code === "42703" ||
        erro?.code === "PGRST204" ||
        /column .* does not exist|schema cache/i.test(erro?.message || "")
    );
}

/**
 * Verifica se a migração 003 (respostas e curtidas de comentários) já foi
 * executada.
 *
 * @returns {Promise<boolean>}
 */
async function colunasDeRespostasDisponiveis() {
    const { error } = await supabase
        .from(TABELA)
        .select("ig_comentario_pai_id, resposta_a_username, eh_resposta, curtidas")
        .limit(1);

    if (!error) return true;
    if (colunaAusente(error)) return false;

    throw error;
}

/**
 * Lista TODOS os comentários já guardados de uma publicação, apenas com o
 * necessário para comparar com uma nova coleta (inclui os removidos).
 *
 * @param {number} publicacaoId
 * @param {{comRespostas: boolean}} opcoes - `false` se a migração 003 não existe.
 * @returns {Promise<Array<{id: number, ig_comentario_id: string,
 *   ig_comentario_pai_id: (string|null|undefined), removido_em: (string|null)}>>}
 */
async function listarParaSincronizar(publicacaoId, { comRespostas }) {
    const colunas = comRespostas
        ? "id, ig_comentario_id, ig_comentario_pai_id, removido_em"
        : "id, ig_comentario_id, removido_em";
    const linhas = [];
    const passo = 1000;

    // O Supabase limita cada resposta (1000 linhas por padrão): pagina-se.
    for (let inicio = 0; ; inicio += passo) {
        const { data, error } = await supabase
            .from(TABELA)
            .select(colunas)
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
 * Conta os comentários ativos (não removidos) de uma publicação, incluindo
 * as respostas.
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
 * Conta as respostas de uma publicação (exige a migração 003).
 *
 * @param {number} publicacaoId
 * @param {boolean} incluirRemovidos
 * @returns {Promise<number>}
 */
async function contarRespostas(publicacaoId, incluirRemovidos) {
    let consulta = supabase
        .from(TABELA)
        .select("id", { count: "exact", head: true })
        .eq("publicacao_id", publicacaoId)
        .not("ig_comentario_pai_id", "is", null);

    if (!incluirRemovidos) consulta = consulta.is("removido_em", null);

    const { count, error } = await consulta;

    if (error) throw error;

    return count || 0;
}

/**
 * Lista os comentários PRINCIPAIS de uma publicação, do mais recente ao mais
 * antigo. (As respostas vêm de `listarRespostas`.)
 *
 * @param {number} publicacaoId
 * @param {{limite: number, deslocamento: number, incluirRemovidos: boolean,
 *   comRespostas: boolean}} opcoes - `comRespostas: false` (migração 003
 *   pendente) lista tudo, sem os campos novos.
 * @returns {Promise<{itens: object[], total: number}>} `total` considera o
 *   mesmo filtro, para paginação.
 */
async function listarPorPublicacao(
    publicacaoId,
    { limite, deslocamento, incluirRemovidos, comRespostas }
) {
    let consulta = supabase
        .from(TABELA)
        .select(comRespostas ? COLUNAS_COM_RESPOSTAS : COLUNAS_BASE, { count: "exact" })
        .eq("publicacao_id", publicacaoId)
        .order("publicado_em", { ascending: false })
        .order("id", { ascending: false })
        .range(deslocamento, deslocamento + limite - 1);

    if (comRespostas) consulta = consulta.is("ig_comentario_pai_id", null);
    if (!incluirRemovidos) consulta = consulta.is("removido_em", null);

    const { data, count, error } = await consulta;

    if (error) throw error;

    return { itens: data || [], total: count || 0 };
}

/**
 * Lista as respostas dos comentários informados, na ordem da conversa
 * (a mais antiga primeiro). Exige a migração 003.
 *
 * @param {number} publicacaoId
 * @param {string[]} paiIds - `ig_comentario_id` dos comentários principais.
 * @param {boolean} incluirRemovidos
 * @returns {Promise<object[]>}
 */
async function listarRespostas(publicacaoId, paiIds, incluirRemovidos) {
    if (paiIds.length === 0) return [];

    let consulta = supabase
        .from(TABELA)
        .select(COLUNAS_COM_RESPOSTAS)
        .eq("publicacao_id", publicacaoId)
        .in("ig_comentario_pai_id", paiIds)
        .order("publicado_em", { ascending: true })
        .order("id", { ascending: true });

    if (!incluirRemovidos) consulta = consulta.is("removido_em", null);

    const { data, error } = await consulta;

    if (error) throw error;

    return data || [];
}

module.exports = {
    colunasDeRespostasDisponiveis,
    listarParaSincronizar,
    gravarLote,
    marcarRemovidos,
    contarAtivos,
    contarRespostas,
    listarPorPublicacao,
    listarRespostas
};
