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

/** Inicia o login do Instagram no navegador da maquina do backend. */
export function conectarInstagram(contaId) {
  return requisicao(`/contas/${contaId}/conectar`, { method: "POST" });
}

/** Consulta o estado do processo de conexao. */
export function consultarConexao(contaId) {
  return requisicao(`/contas/${contaId}/conexao`);
}

/** Remove a sessao local da conta. */
export function desconectarInstagram(contaId) {
  return requisicao(`/contas/${contaId}/conexao`, { method: "DELETE" });
}
