/**
 * Repositório de clientes (tabela `clientes`).
 * Camada de acesso a dados: só conhece o Supabase.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "clientes";
const COLUNAS = "id, nome, ativo, criado_em";

/** Código do Postgres para violação de unicidade. */
const VIOLACAO_UNICA = "23505";

/** Escapa os curingas do `ilike` (`%`, `_` e `\`) para busca exata. */
function escaparPadrao(texto) {
    return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function buscarPorId(id) {
    const { data, error } = await supabase
        .from(TABELA).select(COLUNAS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
}

/** Busca pelo nome, sem diferenciar maiúsculas/minúsculas. */
async function buscarPorNome(nome) {
    const { data, error } = await supabase
        .from(TABELA).select(COLUNAS)
        .ilike("nome", escaparPadrao(nome.trim()))
        .maybeSingle();
    if (error) throw error;
    return data;
}

/**
 * Devolve o cliente com esse nome, criando-o se ainda não existir.
 * Seguro contra dois cadastros simultâneos do mesmo nome.
 *
 * @param {string} nome
 * @returns {Promise<object>}
 */
async function buscarOuCriarPorNome(nome) {
    const existente = await buscarPorNome(nome);
    if (existente) return existente;

    const { data, error } = await supabase
        .from(TABELA).insert({ nome: nome.trim() }).select(COLUNAS).single();

    if (error?.code === VIOLACAO_UNICA) return buscarPorNome(nome);
    if (error) throw error;

    return data;
}

module.exports = { buscarPorId, buscarPorNome, buscarOuCriarPorNome };
