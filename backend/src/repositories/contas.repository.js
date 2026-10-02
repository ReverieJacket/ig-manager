/**
 * Repositório de contas do Instagram (tabela `contas_instagram`).
 * Camada de acesso a dados: só conhece o Supabase.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "contas_instagram";
const COLUNAS = "id, nome, username, ativo, cliente";

async function listarAtivas() {
    const { data, error } = await supabase.from(TABELA)
        .select(COLUNAS).eq("ativo", true).order("id", { ascending: true });
    if (error) throw error;
    return data || [];
}

async function buscarPorId(id) {
    const { data, error } = await supabase.from(TABELA)
        .select(COLUNAS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
}

async function buscarPorIds(ids) {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from(TABELA)
        .select("id, nome, username").in("id", ids);
    if (error) throw error;
    return data || [];
}

async function buscarPorUsername(username) {
    const { data, error } = await supabase.from(TABELA)
        .select(COLUNAS).ilike("username", username).maybeSingle();
    if (error) throw error;
    return data;
}

async function criar(conta) {
    const { data, error } = await supabase.from(TABELA).insert({
        nome: conta.nome,
        username: conta.username,
        cliente: conta.cliente,
        ativo: true
    }).select(COLUNAS).single();
    if (error) throw error;
    return data;
}


async function criarConvite(convite) {
    const { data, error } = await supabase.from("convites_contas_instagram")
        .insert(convite).select("id, cliente, expires_at, created_at").single();
    if (error) throw error;
    return data;
}
async function buscarConvitePorHash(tokenHash) {
    const { data, error } = await supabase.from("convites_contas_instagram")
        .select("id, cliente, expires_at, used_at").eq("token_hash", tokenHash).maybeSingle();
    if (error) throw error;
    return data;
}
async function marcarConviteUtilizado(id) {
    const { data, error } = await supabase.from("convites_contas_instagram")
        .update({ used_at: new Date().toISOString() }).eq("id", id).is("used_at", null)
        .select("id").maybeSingle();
    if (error) throw error;
    return data;
}
module.exports = { listarAtivas, buscarPorId, buscarPorIds, buscarPorUsername, criar, criarConvite, buscarConvitePorHash, marcarConviteUtilizado };
