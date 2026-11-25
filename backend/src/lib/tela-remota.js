/**
 * Tela remota da conexão do Instagram (lado do site).
 *
 * Cada pedido de conexão tem um canal próprio no Supabase Realtime, cujo nome
 * é derivado do id do pedido com o segredo do backend: não dá para adivinhar
 * o canal de outra pessoa. O site entrega o canal só a quem pode ver aquele
 * perfil e ao Publicador que pegou o pedido.
 */
const crypto = require("crypto");

const { config, MODOS } = require("../config/env");

/** A tela remota está disponível (site na Vercel + chave pública)? */
function disponivel() {
    return config.modo === MODOS.API && Boolean(config.supabase.url && config.supabase.chavePublica);
}

/**
 * Dados para entrar no canal do pedido, ou `null` sem tela remota.
 *
 * @param {number} tarefaId
 * @returns {{url: string, chave: string, canal: string}|null}
 */
function dadosDoCanal(tarefaId) {
    if (!disponivel()) return null;
    const segredo = process.env.AUTH_SEGREDO || config.supabase.chaveServico || "";
    const assinatura = crypto
        .createHmac("sha256", segredo)
        .update(`tela-remota:${tarefaId}`)
        .digest("hex")
        .slice(0, 40);
    return {
        url: config.supabase.url,
        chave: config.supabase.chavePublica,
        canal: `tela-${assinatura}`
    };
}

module.exports = { disponivel, dadosDoCanal };
