/**
 * Pedidos do site para o Publicador (tabela `tarefas_automacao`, migração 011).
 *
 * O site (que pode estar na Vercel, sem navegador) grava o pedido; o
 * Publicador, no computador do administrador, pega, executa e grava o
 * resultado.
 */
const { supabase } = require("../lib/supabase");
const { noEspaco, comEspaco } = require("../lib/espaco");

const TABELA = "tarefas_automacao";

const TIPOS = Object.freeze({
    CONECTAR: "conectar",
    DESCONECTAR: "desconectar",
    COLETAR_COMENTARIOS: "coletar_comentarios"
});

const STATUS_TAREFA = Object.freeze({
    PENDENTE: "pendente",
    EXECUTANDO: "executando",
    CONCLUIDA: "concluida",
    ERRO: "erro"
});

/** Cria um pedido pendente. */
async function criar({ tipo, contaId = null, publicacaoId = null }) {
    const { data, error } = await supabase
        .from(TABELA)
        .insert(comEspaco({ tipo, conta_id: contaId, publicacao_id: publicacaoId }))
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function buscarPorId(id) {
    const { data, error } = await noEspaco(supabase.from(TABELA).select("*")).eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
}

/** Pedido mais recente de um tipo para um perfil (status da conexão). */
async function ultimaDoPerfil(tipo, contaId) {
    const { data, error } = await noEspaco(supabase
        .from(TABELA)
        .select("*"))
        .eq("tipo", tipo)
        .eq("conta_id", contaId)
        .order("criada_em", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data;
}

/** Pedidos ainda não executados, do mais antigo para o mais novo. */
async function listarPendentes(limite = 10) {
    const { data, error } = await noEspaco(supabase
        .from(TABELA)
        .select("*"))
        .eq("status", STATUS_TAREFA.PENDENTE)
        .order("criada_em", { ascending: true })
        .limit(limite);
    if (error) throw error;
    return data || [];
}

/**
 * Marca como "executando" SÓ se ainda estiver pendente: garante que dois
 * Publicadores nunca executem o mesmo pedido.
 *
 * @returns {Promise<object|null>} A tarefa, ou `null` se outro já pegou.
 */
async function pegar(id) {
    const { data, error } = await noEspaco(supabase
        .from(TABELA)
        .update({ status: STATUS_TAREFA.EXECUTANDO, iniciada_em: new Date().toISOString() }))
        .eq("id", id)
        .eq("status", STATUS_TAREFA.PENDENTE)
        .select()
        .maybeSingle();
    if (error) throw error;
    return data;
}

/** Atualiza a mensagem de andamento ("Aguardando o login..."). */
async function informar(id, mensagem) {
    const { error } = await noEspaco(supabase.from(TABELA).update({ mensagem })).eq("id", id);
    if (error) throw error;
}

/** Grava o fim do pedido (`concluida` ou `erro`). */
async function concluir(id, { sucesso, mensagem = null, resultado = null }) {
    const { error } = await noEspaco(supabase
        .from(TABELA)
        .update({
            status: sucesso ? STATUS_TAREFA.CONCLUIDA : STATUS_TAREFA.ERRO,
            mensagem,
            resultado,
            concluida_em: new Date().toISOString()
        }))
        .eq("id", id);
    if (error) throw error;
}

/**
 * Pedidos que ficaram "executando" quando o Publicador fechou: viram erro
 * ao abrir de novo (não se sabe se terminaram).
 */
async function encerrarInterrompidas() {
    const { data, error } = await noEspaco(supabase
        .from(TABELA)
        .update({
            status: STATUS_TAREFA.ERRO,
            mensagem: "O Publicador foi fechado antes de terminar. Tente de novo.",
            concluida_em: new Date().toISOString()
        }))
        .eq("status", STATUS_TAREFA.EXECUTANDO)
        .select("id");
    if (error) throw error;
    return (data || []).length;
}

module.exports = {
    TIPOS,
    STATUS_TAREFA,
    criar,
    buscarPorId,
    ultimaDoPerfil,
    listarPendentes,
    pegar,
    informar,
    concluir,
    encerrarInterrompidas
};
