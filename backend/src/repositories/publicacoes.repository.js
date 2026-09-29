/**
 * Repositório de publicações (tabela `publicacoes`).
 *
 * Camada de acesso a dados: só conhece o Supabase. Todas as funções
 * lançam o erro do Supabase em caso de falha.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "publicacoes";
const COLUNAS = "id, conta_id, imagem, texto, data_hora, status, erro";

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

module.exports = { STATUS, listar, buscarPorId, criar, atualizar };
