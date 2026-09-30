/**
 * Chamadas da API relacionadas a contas do Instagram.
 */
import { requisicao } from "./cliente";

/** Lista as contas ativas. */
export async function listarContas() {
  const contas = await requisicao("/contas");
  return Array.isArray(contas) ? contas : [];
}

/** Cadastra uma conta manualmente. */
export function cadastrarConta(dados) {
  return requisicao("/contas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}
