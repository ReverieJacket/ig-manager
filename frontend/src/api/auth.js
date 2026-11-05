/**
 * Chamadas da API de autenticação.
 */
import { requisicao } from "./cliente";

/**
 * Faz login. O backend grava o cookie de sessão (httpOnly).
 *
 * @param {{email: string, senha: string, manterConectado: boolean}} dados
 * @returns {Promise<object>} Usuário logado.
 */
export async function entrar(dados) {
  const { usuario } = await requisicao("/auth/entrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  return usuario;
}

/**
 * Troca a própria senha. No primeiro acesso `senhaAtual` pode ficar vazia.
 *
 * @param {{senhaAtual?: string, senhaNova: string}} dados
 * @returns {Promise<object>} Usuário atualizado.
 */
export async function trocarSenha(dados) {
  const { usuario } = await requisicao("/auth/trocar-senha", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  return usuario;
}

/**
 * Altera o próprio nome.
 *
 * @param {{nome: string}} dados
 * @returns {Promise<object>} Usuário atualizado.
 */
export async function atualizarPerfil(dados) {
  const { usuario } = await requisicao("/auth/eu", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
  return usuario;
}

/** Encerra a sessão (apaga o cookie). */
export function sair() {
  return requisicao("/auth/sair", { method: "POST" });
}

/**
 * Usuário da sessão atual.
 *
 * @returns {Promise<object|null>} `null` se não houver sessão.
 */
export async function buscarUsuarioAtual() {
  try {
    const { usuario } = await requisicao("/auth/eu");
    return usuario;
  } catch (erro) {
    if (erro.status === 401) return null;
    throw erro;
  }
}
