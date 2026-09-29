/**
 * Cliente HTTP base para falar com o backend.
 *
 * A URL vem de `VITE_API_URL` (ver `frontend/.env.example`), o que
 * permite trocar de ambiente sem alterar código.
 */

/** URL base da API, sem barra final. */
export const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

/**
 * Faz uma requisição e devolve o JSON da resposta.
 *
 * O backend responde erros como `{ sucesso: false, mensagem }`; esta
 * função os converte em `Error` com essa mensagem, para que as telas
 * precisem apenas de um `try/catch`.
 *
 * @param {string} caminho - Rota da API (ex.: "/contas").
 * @param {RequestInit} [opcoes] - Opções do `fetch`.
 * @returns {Promise<any>} Corpo JSON da resposta.
 * @throws {Error} Falha de rede ou resposta de erro do backend.
 */
export async function requisicao(caminho, opcoes) {
  let resposta;

  try {
    resposta = await fetch(`${API_URL}${caminho}`, opcoes);
  } catch {
    throw new Error(
      "Não foi possível conectar ao servidor. Verifique se o backend está em execução."
    );
  }

  const corpo = await resposta.json().catch(() => null);

  if (!resposta.ok || corpo?.sucesso === false) {
    throw new Error(corpo?.mensagem || "Erro ao processar a requisição.");
  }

  return corpo;
}
