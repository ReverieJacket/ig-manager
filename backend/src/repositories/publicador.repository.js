/**
 * "Sinal de vida" do Publicador (tabela `publicadores`, migração 012): uma
 * linha por espaço, que o Publicador daquele espaço atualiza a cada 30
 * segundos.
 *
 * Fora de uma requisição (Publicador local, que atende todos os espaços) o
 * sinal vale para todos os espaços.
 */
const { supabase } = require("../lib/supabase");
const { espacoAtual } = require("../lib/espaco");

const TABELA = "publicadores";

/** Espaços afetados: o da requisição ou, sem requisição, todos. */
async function espacosAlvo() {
    const atual = espacoAtual();
    if (atual !== null) return [atual];

    const { data, error } = await supabase.from("espacos").select("id");
    if (error) throw error;
    return (data || []).map((e) => Number(e.id));
}

async function ler() {
    const atual = espacoAtual();
    let consulta = supabase.from(TABELA).select("*");
    consulta = atual === null
        ? consulta.order("ultimo_sinal", { ascending: false, nullsFirst: false }).limit(1)
        : consulta.eq("espaco_id", atual);

    const { data, error } = await consulta.maybeSingle();
    if (error) throw error;
    return data;
}

/** Atualiza o sinal (e, ao iniciar, quando/onde iniciou). */
async function sinalizar(campos = {}) {
    const espacos = await espacosAlvo();
    if (espacos.length === 0) return;

    const agora = new Date().toISOString();
    const { error } = await supabase
        .from(TABELA)
        .upsert(espacos.map((id) => ({ espaco_id: id, ultimo_sinal: agora, ...campos })));
    if (error) throw error;
}

/** Fechamento normal: o site passa a mostrar "desligado" na hora. */
async function desligar() {
    const espacos = await espacosAlvo();
    if (espacos.length === 0) return;

    const { error } = await supabase
        .from(TABELA).update({ ultimo_sinal: null }).in("espaco_id", espacos);
    if (error) throw error;
}

module.exports = { ler, sinalizar, desligar };
