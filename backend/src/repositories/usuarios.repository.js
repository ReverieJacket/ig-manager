/**
 * Repositório de usuários do sistema (tabela `usuarios`).
 * Camada de acesso a dados: só conhece o Supabase.
 *
 * `senha_hash` só sai daqui pela função `buscarParaLogin`; as demais
 * nunca devolvem o hash.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "usuarios";
const COLUNAS = "id, nome, email, perfil, cliente_id, ativo, ultimo_acesso, clientes(id, nome, ativo)";

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

/**
 * @param {{nome: string, email: string, senha_hash: string,
 *          perfil: ("admin"|"cliente"), cliente_id?: (number|null)}} usuario
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
    const { data, error } = await supabase
        .from(TABELA).update(campos).eq("id", id).select(COLUNAS).single();
    if (error) throw error;
    return data;
}

/** Marca o último acesso. Falha aqui não deve impedir o login. */
async function registrarAcesso(id) {
    const { error } = await supabase
        .from(TABELA).update({ ultimo_acesso: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
}

module.exports = {
    normalizarEmail,
    buscarParaLogin,
    buscarPorId,
    buscarPorEmail,
    criar,
    atualizar,
    registrarAcesso
};
