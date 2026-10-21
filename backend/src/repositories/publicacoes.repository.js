/**
 * Repositório de publicações (tabela `publicacoes`).
 *
 * Camada de acesso a dados: só conhece o Supabase. Todas as funções
 * lançam o erro do Supabase em caso de falha.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "publicacoes";
/**
 * `*` (e não uma lista) para que as colunas criadas em migrações
 * (`ig_codigo`, `comentarios_total`...) apareçam automaticamente e a API
 * não quebre caso a migração ainda não tenha sido executada.
 */
const COLUNAS = "*";

/**
 * Ciclo de vida de uma publicação.
 * `agendada` -> `publicando` -> `publicada` | `erro`
 */
const STATUS = Object.freeze({
    AGENDADA: "agendada",
    PUBLICANDO: "publicando",
    PUBLICADA: "publicada",
    ERRO: "erro"
});

/**
 * Lista todas as publicações, da mais recente para a mais antiga.
 *
 * @returns {Promise<object[]>}
 */
async function listar() {
    const { data, error } = await supabase
        .from(TABELA)
        .select(COLUNAS)
        .order("data_hora", { ascending: false });

    if (error) throw error;

    return data || [];
}

/**
 * Lista as publicações de um conjunto de contas, da mais recente para a
 * mais antiga (área do cliente).
 *
 * @param {number[]} contaIds
 * @param {string[]} status - Status a incluir.
 * @returns {Promise<object[]>}
 */
async function listarPorContas(contaIds, status) {
    if (contaIds.length === 0) return [];

    const { data, error } = await supabase
        .from(TABELA)
        .select(COLUNAS)
        .in("conta_id", contaIds)
        .in("status", status)
        .order("data_hora", { ascending: false });

    if (error) throw error;

    return data || [];
}

/**
 * Indica se o perfil tem alguma publicação (de qualquer status).
 *
 * @param {number} contaId
 * @returns {Promise<boolean>}
 */
async function existeParaConta(contaId) {
    const { count, error } = await supabase
        .from(TABELA)
        .select("id", { count: "exact", head: true })
        .eq("conta_id", contaId);

    if (error) throw error;

    return (count || 0) > 0;
}

/**
 * Busca uma publicação pelo identificador.
 *
 * @param {number} id
 * @returns {Promise<object|null>} A publicação, ou `null` se não existir.
 */
async function buscarPorId(id) {
    const { data, error } = await supabase
        .from(TABELA)
        .select(COLUNAS)
        .eq("id", id)
        .maybeSingle();

    if (error) throw error;

    return data;
}

/**
 * Lista as publicações com um status, da mais antiga para a mais nova
 * (ordem em que deveriam ter sido executadas).
 *
 * @param {string} status - Um dos valores de `STATUS`.
 * @returns {Promise<object[]>}
 */
async function listarPorStatus(status) {
    const { data, error } = await supabase
        .from(TABELA)
        .select(COLUNAS)
        .eq("status", status)
        .order("data_hora", { ascending: true });

    if (error) throw error;

    return data || [];
}

/**
 * Insere uma nova publicação.
 *
 * @param {{conta_id: number, imagem: string, texto: string,
 *          data_hora: string, status: string, erro: (string|null)}} registro
 * @returns {Promise<object>} O registro criado (com `id`).
 */
async function criar(registro) {
    const { data, error } = await supabase
        .from(TABELA)
        .insert(registro)
        .select()
        .single();

    if (error) throw error;

    return data;
}

/**
 * Atualiza campos de uma publicação.
 *
 * @param {number} id
 * @param {object} campos - Colunas a alterar (ex.: `{ status, erro }`).
 * @returns {Promise<object>} O registro atualizado.
 */
async function atualizar(id, campos) {
    const { data, error } = await supabase
        .from(TABELA)
        .update(campos)
        .eq("id", id)
        .select()
        .single();

    if (error) throw error;

    return data;
}

module.exports = {
    STATUS,
    listar,
    listarPorContas,
    existeParaConta,
    listarPorStatus,
    buscarPorId,
    criar,
    atualizar
};
