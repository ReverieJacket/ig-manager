/**
 * Repositório de espaços (tabela `espacos`, migração 012). Cada
 * administrador que se cadastra pelo Publicador ganha um espaço.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "espacos";
const COLUNAS = "id, nome, criado_em";

async function criar(nome) {
    const { data, error } = await supabase
        .from(TABELA).insert({ nome: nome.trim() }).select(COLUNAS).single();
    if (error) throw error;
    return data;
}

/** Desfaz um cadastro que não terminou (o administrador não foi criado). */
async function excluir(id) {
    const { error } = await supabase.from(TABELA).delete().eq("id", id);
    if (error) throw error;
}

/** Primeiro espaço (o dos dados de antes da migração 012). */
async function primeiro() {
    const { data, error } = await supabase
        .from(TABELA).select(COLUNAS).order("id", { ascending: true }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
}

module.exports = { criar, excluir, primeiro };
