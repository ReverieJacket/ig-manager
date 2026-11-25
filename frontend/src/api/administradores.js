/**
 * Chamadas da API da tela "Equipe" (administradores do mesmo espaço).
 */
import { requisicao } from "./cliente";

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function listarAdministradores() {
  const corpo = await requisicao("/administradores");
  return corpo.administradores || [];
}

/** @returns {Promise<{usuario: object, senhaTemporaria: string}>} */
export function criarAdministrador(dados) {
  return requisicao("/administradores", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(dados),
  });
}

export function atualizarAdministrador(id, dados) {
  return requisicao(`/administradores/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(dados),
  });
}

/** @returns {Promise<{usuario: object, senhaTemporaria: string}>} */
export function redefinirSenhaAdministrador(id) {
  return requisicao(`/administradores/${id}/redefinir-senha`, { method: "POST" });
}
