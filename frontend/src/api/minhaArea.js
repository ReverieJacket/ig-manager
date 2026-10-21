/**
 * Chamadas da API da área do cliente. O backend filtra tudo pelo cliente
 * da sessão; nenhuma chamada informa o cliente.
 */
import { API_URL, requisicao } from "./cliente";

/** Perfis do Instagram do cliente, com `status` e `podeConectar`. */
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

/** Abre o Chromium (na máquina do backend) para o login no Instagram. */
export function conectarMeuPerfil(id) {
  return requisicao(`/minha-area/contas/${id}/conectar`, { method: "POST" });
}

/** Andamento da conexão: iniciando | aguardando_login | conectado | cancelado | erro. */
export function consultarConexaoMeuPerfil(id) {
  return requisicao(`/minha-area/contas/${id}/conexao`);
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

/* ------------------------------- aprovações ------------------------------ */

const comImagem = (publicacao) => ({
  ...publicacao,
  imagem: publicacao.imagem ? `${API_URL}${publicacao.imagem}` : null,
});

/**
 * Tela Aprovações.
 *
 * @returns {Promise<{pendentes: object[], respondidas: object[]}>}
 */
export async function listarAprovacoes() {
  const r = await requisicao("/minha-area/aprovacoes");
  return {
    pendentes: (r?.pendentes || []).map(comImagem),
    respondidas: (r?.respondidas || []).map(comImagem),
  };
}

/**
 * Defere ou indefere uma publicação.
 *
 * @param {number} id
 * @param {{decisao: "deferida"|"indeferida", categoria?: string, motivo?: string}} dados
 */
export function responderAprovacao(id, dados) {
  return requisicao(`/minha-area/aprovacoes/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dados),
  });
}

/**
 * Defere várias de uma vez.
 *
 * @returns {Promise<{deferidas: number[], falhas: {id: number, mensagem: string}[]}>}
 */
export function deferirVarias(ids) {
  return requisicao("/minha-area/aprovacoes/deferir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}
