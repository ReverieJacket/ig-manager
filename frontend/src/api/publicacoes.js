/**
 * Chamadas da API relacionadas a publicações.
 */
import { API_URL, requisicao } from "./cliente";

/**
 * Lista as publicações. O caminho relativo da imagem devolvido pelo
 * backend (`/uploads/...`) é convertido em URL absoluta; sem isso o
 * navegador procuraria a imagem no servidor do frontend.
 *
 * @returns {Promise<object[]>}
 */
export async function listarPublicacoes() {
  const publicacoes = await requisicao("/publicacoes");

  return publicacoes.map((publicacao) => ({
    ...publicacao,
    imagem: publicacao.imagem ? `${API_URL}${publicacao.imagem}` : null,
  }));
}

/**
 * Cria uma publicação imediata ou agendada.
 *
 * @param {Object} dados
 * @param {File} dados.imagem - Arquivo de imagem.
 * @param {string} dados.texto - Legenda.
 * @param {string} dados.dataHora - Data/hora em ISO 8601 (com fuso).
 * @param {string|number} dados.contaId - Conta que publicará.
 * @returns {Promise<{sucesso: boolean, mensagem: string, id: number}>}
 */
export function criarPublicacao({ imagem, texto, dataHora, contaId }) {
  const formulario = new FormData();

  formulario.append("imagem", imagem);
  formulario.append("texto", texto);
  formulario.append("dataHora", dataHora);
  formulario.append("conta_id", contaId);

  return requisicao("/publicacoes", { method: "POST", body: formulario });
}
