/**
 * Chamadas da API relacionadas a contas do Instagram.
 */
import { requisicao } from "./cliente";

/**
 * Lista as contas ativas.
 *
 * @returns {Promise<Array<{id: number, nome: string, username: string}>>}
 */
export async function listarContas() {
  const contas = await requisicao("/contas");

  return Array.isArray(contas) ? contas : [];
}
