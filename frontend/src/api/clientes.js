/**
 * Chamadas da API da tela "Clientes" (administrador).
 */
import { requisicao } from "./cliente";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Lista os clientes com contadores. */
export async function listarClientes() {
  const lista = await requisicao("/clientes");
  return Array.isArray(lista) ? lista : [];
}

/** Detalhe de um cliente: `{ cliente, usuarios, contas }`. */
export function buscarCliente(id) {
  return requisicao(`/clientes/${id}`);
}

/**
 * Cria cliente + primeiro usuário.
 *
 * @param {{nome: string, usuario: {nome: string, email: string}}} dados
 * @returns {Promise<{cliente: object, usuario: object, senhaTemporaria: string}>}
 */
export function criarCliente(dados) {
  return requisicao("/clientes", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(dados),
  });
}

/** Renomeia, desativa ou reativa um cliente (`{ nome?, ativo? }`). */
export function atualizarCliente(id, dados) {
  return requisicao(`/clientes/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(dados),
  });
}

/**
 * Exclui o cliente de vez (com usuários e contas do Instagram).
 * O backend recusa (409) se alguma conta já tiver publicações.
 *
 * @returns {Promise<{contasExcluidas: number, usuariosExcluidos: number}>}
 */
export function excluirCliente(id) {
  return requisicao(`/clientes/${id}`, { method: "DELETE" });
}

/**
 * Adiciona um usuário a um cliente.
 *
 * @returns {Promise<{usuario: object, senhaTemporaria: string}>}
 */
export function adicionarUsuario(clienteId, dados) {
  return requisicao(`/clientes/${clienteId}/usuarios`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(dados),
  });
}

/** Altera nome, e-mail ou situação de um usuário (`{ nome?, email?, ativo? }`). */
export function atualizarUsuario(id, dados) {
  return requisicao(`/usuarios/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(dados),
  });
}

/**
 * Gera uma nova senha temporária para o usuário.
 *
 * @returns {Promise<{usuario: object, senhaTemporaria: string}>}
 */
export function redefinirSenha(id) {
  return requisicao(`/usuarios/${id}/redefinir-senha`, { method: "POST" });
}
