/**
 * Chamadas da API da área do cliente. O backend filtra tudo pelo cliente
 * da sessão; nenhuma chamada informa o cliente.
 */
import { API_URL, requisicao } from "./cliente";

/** Contas do Instagram do cliente, com `conectada`. */
export async function listarMinhasContas() {
  const lista = await requisicao("/minha-area/contas");
  return Array.isArray(lista) ? lista : [];
}

/**
 * Informa uma conta nova do Instagram (sem senha).
 *
 * @param {{nome: string, username: string}} dados
 */
export function adicionarMinhaConta(dados) {
  return requisicao("/minha-area/contas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}

/**
 * Publicações programadas e publicadas das contas do cliente. A imagem
 * vem como caminho relativo do backend e é completada com `API_URL`.
 */
export async function listarMinhasPublicacoes() {
  const lista = await requisicao("/minha-area/publicacoes");
  return (Array.isArray(lista) ? lista : []).map((publicacao) => ({
    ...publicacao,
    imagem: publicacao.imagem ? `${API_URL}${publicacao.imagem}` : null,
  }));
}
