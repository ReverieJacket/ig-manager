/**
 * Repositório do histórico de curtidas (tabela `curtidas_historico`).
 *
 * O valor MAIS RECENTE fica na própria publicação (colunas `curtidas`,
 * `curtidas_aproximado`, `curtidas_atualizado_em`); aqui fica uma linha
 * por coleta, para acompanhar a evolução ao longo do tempo.
 */
const { supabase } = require("../lib/supabase");

const TABELA = "curtidas_historico";

/**
 * Registra uma leitura de curtidas.
 *
 * @param {Object} leitura
 * @param {number} leitura.publicacaoId
 * @param {number} leitura.contaId
 * @param {number} leitura.curtidas - Quantidade lida.
 * @param {boolean} leitura.aproximado - `true` se o Instagram mostrou o número abreviado.
 * @param {string} leitura.coletadoEm - Instante ISO da coleta.
 * @returns {Promise<void>}
 */
async function registrarHistorico({ publicacaoId, contaId, curtidas, aproximado, coletadoEm }) {
    const { error } = await supabase.from(TABELA).insert({
        publicacao_id: publicacaoId,
        conta_id: contaId,
        curtidas,
        aproximado,
        coletado_em: coletadoEm
    });

    if (error) throw error;
}

module.exports = { registrarHistorico };
