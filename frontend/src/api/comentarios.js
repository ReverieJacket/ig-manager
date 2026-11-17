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
export async function coletarComentarios(publicacaoId) {
  const resposta = await requisicao(`/publicacoes/${publicacaoId}/comentarios/coletar`, {
    method: "POST",
  });

  // Site na Vercel: o Publicador coleta no computador dele; acompanhamos o pedido.
  if (resposta?.emAndamento && resposta.tarefaId) {
    return esperarTarefa(resposta.tarefaId);
  }

  return resposta;
}

/** Consulta um pedido ao Publicador a cada 3 s, por até 6 minutos. */
async function esperarTarefa(tarefaId) {
  const limite = Date.now() + 6 * 60 * 1000;

  while (Date.now() < limite) {
    await new Promise((resolver) => setTimeout(resolver, 3000));
    const tarefa = await requisicao(`/tarefas/${tarefaId}`);

    if (tarefa.status === "concluida") return tarefa.resultado || {};
    if (tarefa.status === "erro") {
      throw new Error(tarefa.mensagem || "O Publicador não conseguiu coletar os comentários.");
    }
  }

  throw new Error("A coleta está demorando; confira de novo em alguns minutos.");
}
