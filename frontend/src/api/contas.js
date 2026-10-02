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

/** Gera um convite exclusivo de cadastro para um cliente. */
export function gerarConviteConta(dados) {
  return requisicao("/contas/convites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}

/** Consulta os dados públicos de um convite. */
export function consultarConviteConta(token) {
  return requisicao(`/contas/convites/${encodeURIComponent(token)}`);
}

/** Envia o cadastro realizado pelo cliente usando o convite. */
export function cadastrarContaPorConvite(token, dados) {
  return requisicao(`/contas/convites/${encodeURIComponent(token)}/cadastro`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}
