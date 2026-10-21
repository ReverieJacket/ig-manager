/**
 * Repositório de usuários do sistema (tabela `usuarios`).
 * Camada de acesso a dados: só conhece o Supabase.
 *
 * `senha_hash` só sai daqui pelas funções `buscarParaLogin` e
 * `buscarHashPorId`; as demais nunca devolvem o hash.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "usuarios";
const COLUNAS =
    "id, nome, email, perfil, cliente_id, ativo, ultimo_acesso, criado_em, " +
    "senha_temporaria, sessao_versao, clientes(id, nome, ativo)";

/** Código do Postgres para violação de unicidade (e-mail repetido). */
const VIOLACAO_UNICA = "23505";

/** E-mail sempre comparado/gravado em minúsculas e sem espaços. */
function normalizarEmail(email) {
    return String(email || "").trim().toLowerCase();
}

/** Busca o usuário com o hash da senha (uso exclusivo do login). */
async function buscarParaLogin(email) {
    const { data, error } = await supabase
        .from(TABELA)
        .select(`${COLUNAS}, senha_hash`)
        .eq("email", normalizarEmail(email))
        .maybeSingle();
    if (error) throw error;
    return data;
}

/** Hash da senha atual (uso exclusivo da troca de senha). */
async function buscarHashPorId(id) {
    const { data, error } = await supabase
        .from(TABELA).select("id, senha_hash").eq("id", id).maybeSingle();
    if (error) throw error;
    return data?.senha_hash || null;
}

async function buscarPorId(id) {
    const { data, error } = await supabase
        .from(TABELA).select(COLUNAS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
}

async function buscarPorEmail(email) {
    const { data, error } = await supabase
        .from(TABELA).select(COLUNAS).eq("email", normalizarEmail(email)).maybeSingle();
    if (error) throw error;
    return data;
}

/** Usuários de um cliente, do mais antigo para o mais novo. */
async function listarPorCliente(clienteId) {
    const { data, error } = await supabase
        .from(TABELA).select(COLUNAS)
        .eq("cliente_id", clienteId)
        .order("id", { ascending: true });
    if (error) throw error;
    return data || [];
}

/**
 * @param {{nome: string, email: string, senha_hash: string,
 *          perfil: ("admin"|"cliente"), cliente_id?: (number|null),
 *          senha_temporaria?: boolean}} usuario
 */
async function criar(usuario) {
    const { data, error } = await supabase
        .from(TABELA)
        .insert({ ...usuario, email: normalizarEmail(usuario.email) })
        .select(COLUNAS)
        .single();
    if (error) throw error;
    return data;
}

async function atualizar(id, campos) {
    const dados = "email" in campos
        ? { ...campos, email: normalizarEmail(campos.email) }
        : campos;

    const { data, error } = await supabase
        .from(TABELA).update(dados).eq("id", id).select(COLUNAS).single();
    if (error) throw error;
    return data;
}

/** Marca o último acesso. Falha aqui não deve impedir o login. */
async function registrarAcesso(id) {
    const { error } = await supabase
        .from(TABELA).update({ ultimo_acesso: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
}
/**
 * Nomes de vários usuários (quem respondeu as aprovações).
 *
 * @param {number[]} ids
 * @returns {Promise<{id: number, nome: string, perfil: string}[]>}
 */
async function buscarNomesPorIds(ids) {
    if (ids.length === 0) return [];
    const { data, error } = await supabase
        .from(TABELA).select("id, nome, perfil").in("id", ids);
    if (error) throw error;
    return data || [];
}

module.exports = {
    VIOLACAO_UNICA,
    normalizarEmail,
    buscarParaLogin,
    buscarHashPorId,
    buscarPorId,
    buscarNomesPorIds,
    buscarPorEmail,
    listarPorCliente,
    criar,
    atualizar,
    registrarAcesso
};
