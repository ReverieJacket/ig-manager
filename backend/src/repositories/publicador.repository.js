/**
 * "Sinal de vida" do Publicador (tabela `publicador_estado`, migração 011):
 * uma única linha (id = 1) que o Publicador atualiza a cada 30 segundos.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "publicador_estado";

async function ler() {
    const { data, error } = await supabase.from(TABELA).select("*").eq("id", 1).maybeSingle();
    if (error) throw error;
    return data;
}

/** Atualiza o sinal (e, ao iniciar, quando/onde iniciou). */
async function sinalizar(campos = {}) {
    const { error } = await supabase
        .from(TABELA)
        .upsert({ id: 1, ultimo_sinal: new Date().toISOString(), ...campos });
    if (error) throw error;
}

/** Fechamento normal: o site passa a mostrar "desligado" na hora. */
async function desligar() {
    const { error } = await supabase.from(TABELA).update({ ultimo_sinal: null }).eq("id", 1);
    if (error) throw error;
}

module.exports = { ler, sinalizar, desligar };
