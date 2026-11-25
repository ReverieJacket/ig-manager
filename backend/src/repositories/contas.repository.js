/**
 * Repositório de contas do Instagram (tabela `contas_instagram`).
 * Camada de acesso a dados: só conhece o Supabase.
 */
const { supabase } = require("../lib/supabase");
const { noEspaco, comEspaco } = require("../lib/espaco");

const TABELA = "contas_instagram";
/** Colunas de `sessao_*` criadas na migração 007. */
/**
 * `*` para incluir colunas de migrações recentes (ex.: `sessao_salva_em`,
 * da 011) sem quebrar enquanto a migração não for executada.
 */
const COLUNAS = "*";

async function listarAtivas() {
    const { data, error } = await noEspaco(supabase.from(TABELA)
        .select(COLUNAS)).eq("ativo", true).order("id", { ascending: true });
    if (error) throw error;
    return data || [];
}

async function buscarPorId(id) {
    const { data, error } = await noEspaco(supabase.from(TABELA)
        .select(COLUNAS)).eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
}

async function buscarPorIds(ids) {
    if (ids.length === 0) return [];
    const { data, error } = await noEspaco(supabase.from(TABELA)
        .select("id, nome, username, cliente_id, clientes(id, nome)")).in("id", ids);
    if (error) throw error;
    return data || [];
}

async function buscarPorUsername(username) {
    // `_` é curinga no ilike e é comum em @ do Instagram: escapa para busca exata.
    const { data, error } = await noEspaco(supabase.from(TABELA)
        .select(COLUNAS)).ilike("username", username.replace(/[\\%_]/g, (c) => `\\${c}`))
        .maybeSingle();
    if (error) throw error;
    return data;
}

/**
 * Contas de um cliente (ativas e inativas), com quem cadastrou e quando.
 * Requer a migração 005.
 */
async function listarPorCliente(clienteId) {
    const { data, error } = await noEspaco(supabase.from(TABELA)
        .select(`${COLUNAS}, autor:usuarios!cadastrada_por(nome)`))
        .eq("cliente_id", clienteId)
        .order("id", { ascending: true });
    if (error) throw error;
    return data || [];
}

/**
 * Todos os perfis ativos com o cliente de cada um (tela Criar, avisos).
 */
async function listarAtivasComCliente() {
    const { data, error } = await noEspaco(supabase.from(TABELA)
        .select(`${COLUNAS}, clientes(id, nome, ativo)`))
        .eq("ativo", true)
        .order("username", { ascending: true });
    if (error) throw error;
    return data || [];
}

async function atualizar(id, campos) {
    const { data, error } = await noEspaco(supabase.from(TABELA)
        .update(campos)).eq("id", id).select(COLUNAS).single();
    if (error) throw error;
    return data;
}

/** Marca o perfil como "sessão expirada" (o Instagram pediu login de novo). */
async function marcarSessaoExpirada(id, mensagem) {
    const { error } = await noEspaco(supabase.from(TABELA)
        .update({ sessao_expirada_em: new Date().toISOString(), sessao_erro: mensagem || null }))
        .eq("id", id);
    if (error) throw error;
}

/** Limpa a marca de sessão expirada (após reconectar ou desconectar). */
async function limparSessaoExpirada(id) {
    const { error } = await noEspaco(supabase.from(TABELA)
        .update({ sessao_expirada_em: null, sessao_erro: null }))
        .eq("id", id)
        .not("sessao_expirada_em", "is", null);
    if (error) throw error;
}

/**
 * Registra se o perfil tem sessão salva no computador do Publicador
 * (`quando` = instante ISO) ou não (`null`). Coluna da migração 011: sem
 * ela, apenas avisa quem chamou (o erro sobe).
 */
async function definirSessaoSalva(id, quando) {
    const { error } = await noEspaco(supabase.from(TABELA)
        .update({ sessao_salva_em: quando }))
        .eq("id", id);
    if (error) throw error;
}

/** Exclui o perfil (o serviço garante antes que não há publicações). */
async function excluir(id) {
    const { error } = await noEspaco(supabase.from(TABELA).delete()).eq("id", id);
    if (error) throw error;
}

async function criar(conta) {
    const { data, error } = await supabase.from(TABELA).insert(comEspaco({
        nome: conta.nome,
        username: conta.username,
        // Texto mantido por compatibilidade; o vínculo oficial é `cliente_id`.
        cliente: conta.cliente,
        cliente_id: conta.clienteId,
        // Só enviado quando há autor (coluna criada na migração 005).
        ...(conta.cadastradaPor ? { cadastrada_por: conta.cadastradaPor } : {}),
        ativo: true
    })).select(COLUNAS).single();
    if (error) throw error;
    return data;
}


async function criarConvite(convite) {
    const { data, error } = await supabase.from("convites_contas_instagram")
        .insert(comEspaco(convite)).select("id, cliente, expires_at, created_at").single();
    if (error) throw error;
    return data;
}
async function buscarConvitePorHash(tokenHash) {
    const { data, error } = await noEspaco(supabase.from("convites_contas_instagram")
        .select("id, cliente, cliente_id, espaco_id, expires_at, used_at")).eq("token_hash", tokenHash).maybeSingle();
    if (error) throw error;
    return data;
}
async function marcarConviteUtilizado(id) {
    const { data, error } = await noEspaco(supabase.from("convites_contas_instagram")
        .update({ used_at: new Date().toISOString() })).eq("id", id).is("used_at", null)
        .select("id").maybeSingle();
    if (error) throw error;
    return data;
}
/**
 * O @ já está cadastrado em QUALQUER espaço? Um perfil do Instagram só pode
 * pertencer a um espaço (dois Publicadores no mesmo perfil dariam conflito).
 */
async function usernameEmUso(username) {
    const { data, error } = await supabase.from(TABELA)
        .select("id").ilike("username", username.replace(/[\\%_]/g, (c) => `\\${c}`))
        .limit(1);
    if (error) throw error;
    return (data || []).length > 0;
}

module.exports = {
    usernameEmUso,
    listarAtivas,
    listarAtivasComCliente,
    buscarPorId,
    buscarPorIds,
    buscarPorUsername,
    listarPorCliente,
    criar,
    atualizar,
    marcarSessaoExpirada,
    limparSessaoExpirada,
    definirSessaoSalva,
    excluir,
    criarConvite,
    buscarConvitePorHash,
    marcarConviteUtilizado
};
