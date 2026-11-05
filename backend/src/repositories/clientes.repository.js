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

/**
 * Lista os clientes com um resumo de usuários e contas (para a tela do
 * administrador), em ordem alfabética.
 */
async function listarComResumo() {
    const { data, error } = await supabase
        .from(TABELA)
        .select(
            `${COLUNAS}, usuarios(id, ativo, senha_temporaria), contas_instagram(id, ativo, sessao_expirada_em)`
        )
        .order("nome", { ascending: true });
    if (error) throw error;
    return data || [];
}

/**
 * Cria um cliente novo. Nome repetido gera erro 23505 (o serviço trata).
 *
 * @param {string} nome
 */
async function criar(nome) {
    const { data, error } = await supabase
        .from(TABELA).insert({ nome: nome.trim() }).select(COLUNAS).single();
    if (error) throw error;
    return data;
}

async function atualizar(id, campos) {
    const { data, error } = await supabase
        .from(TABELA).update(campos).eq("id", id).select(COLUNAS).single();
    if (error) throw error;
    return data;
}

/**
 * Exclui definitivamente o cliente, os usuários e as contas do Instagram
 * dele numa única transação (função `excluir_cliente`, migração 006).
 * O banco recusa se alguma conta já tiver publicações.
 *
 * @param {number} id
 * @returns {Promise<{contasExcluidas: number[], usuariosExcluidos: number}>}
 */
async function excluir(id) {
    const { data, error } = await supabase.rpc("excluir_cliente", { p_cliente_id: id });
    if (error) throw error;

    const linha = Array.isArray(data) ? data[0] : data;
    return {
        contasExcluidas: (linha?.contas_excluidas || []).map(Number),
        usuariosExcluidos: Number(linha?.usuarios_excluidos || 0)
    };
}

module.exports = {
    VIOLACAO_UNICA,
    excluir,
    buscarPorId,
    buscarPorNome,
    buscarOuCriarPorNome,
    listarComResumo,
    criar,
    atualizar
};
