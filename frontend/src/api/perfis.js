/**
 * Chamadas da API de perfis do Instagram (administrador).
 * Conectar/desconectar continuam em `api/contas.js`.
 */
import { requisicao } from "./cliente";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Todos os perfis ativos com `cliente` e `status` (conectado/aguardando/expirada). */
export async function listarPerfis() {
  const lista = await requisicao("/perfis");
  return Array.isArray(lista) ? lista : [];
}

/** Perfis com sessão expirada. */
export async function listarPerfisEmAtencao() {
  const lista = await requisicao("/perfis/atencao");
  return Array.isArray(lista) ? lista : [];
}

/** Admin adiciona um perfil a um cliente. */
export async function adicionarPerfil(clienteId, dados) {
  const { perfil } = await requisicao(`/clientes/${clienteId}/perfis`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(dados),
  });
  return perfil;
}

/** Renomeia o perfil (o @ não muda). */
export function renomearPerfil(id, nome) {
  return requisicao(`/perfis/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ nome }),
  });
}

/** Remove o perfil (o backend recusa se houver publicações). */
export function removerPerfil(id) {
  return requisicao(`/perfis/${id}`, { method: "DELETE" });
}

/**
 * Gera o link para o cliente informar o @.
 *
 * @returns {Promise<{url: string, expiraEm: string}>}
 */
export function gerarLinkCliente(clienteId, validadeHoras) {
  return requisicao(`/clientes/${clienteId}/link`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ validadeHoras }),
  });
}
