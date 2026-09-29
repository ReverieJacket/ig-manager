/**
 * Repositório de contas do Instagram (tabela `contas_instagram`).
 *
 * Camada de acesso a dados: só conhece o Supabase. Regras de negócio
 * ficam nos serviços. Todas as funções lançam o erro do Supabase em
 * caso de falha.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "contas_instagram";
const COLUNAS = "id, nome, username, ativo";

/**
 * Lista as contas ativas, da mais antiga para a mais recente.
 *
 * @returns {Promise<Array<{id: number, nome: string, username: string, ativo: boolean}>>}
 */
async function listarAtivas() {
    const { data, error } = await supabase
        .from(TABELA)
        .select(COLUNAS)
        .eq("ativo", true)
        .order("id", { ascending: true });

    if (error) throw error;

    return data || [];
}

/**
 * Busca uma conta pelo identificador.
 *
 * @param {number} id - Identificador da conta.
 * @returns {Promise<object|null>} A conta, ou `null` se não existir.
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
 * Busca várias contas de uma vez (evita uma consulta por publicação).
 *
 * @param {number[]} ids - Identificadores desejados.
 * @returns {Promise<object[]>} Contas encontradas.
 */
async function buscarPorIds(ids) {
    if (ids.length === 0) return [];

    const { data, error } = await supabase
        .from(TABELA)
        .select("id, nome, username")
        .in("id", ids);

    if (error) throw error;

    return data || [];
}

module.exports = { listarAtivas, buscarPorId, buscarPorIds };
