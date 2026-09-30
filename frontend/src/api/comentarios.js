/**
 * Chamadas da API relacionadas a comentários das publicações.
 */
import { requisicao } from "./cliente";

/**
 * Lista os comentários guardados de uma publicação (paginado, mais
 * recentes primeiro).
 *
 * @param {number} publicacaoId
 * @param {Object} [opcoes]
 * @param {number} [opcoes.pagina=1]
 * @param {number} [opcoes.limite=30]
 * @param {boolean} [opcoes.incluirRemovidos=false] - Inclui os que sumiram do Instagram.
 * @returns {Promise<{total: number, pagina: number, limite: number,
 *   atualizado_em: (string|null), itens: Array<object>}>}
 */
export function listarComentarios(
  publicacaoId,
  { pagina = 1, limite = 30, incluirRemovidos = false } = {}
) {
  const params = new URLSearchParams({ pagina, limite, incluirRemovidos });

  return requisicao(`/publicacoes/${publicacaoId}/comentarios?${params}`);
}

/**
 * Pede ao backend para coletar AGORA os comentários no Instagram.
 * A resposta demora (abre um navegador): pode levar alguns minutos.
 *
 * @param {number} publicacaoId
 * @returns {Promise<{novos: number, reaparecidos: number, removidos: number,
 *   total: number, completa: boolean}>}
 */
export function coletarComentarios(publicacaoId) {
  return requisicao(`/publicacoes/${publicacaoId}/comentarios/coletar`, {
    method: "POST",
  });
}
