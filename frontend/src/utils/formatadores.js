/**
 * Funções puras de formatação usadas nas telas.
 */
import { ROTULOS_STATUS } from "../constants/publicacoes";

/**
 * Normaliza um status para minúsculas, aceitando valores nulos.
 *
 * @param {unknown} status
 * @returns {string}
 */
export function normalizarStatus(status) {
  return String(status ?? "").toLowerCase();
}

/**
 * Converte o status em texto amigável. Status desconhecidos são
 * exibidos como vieram.
 *
 * @param {unknown} status
 * @returns {string}
 */
export function formatarStatus(status) {
  return ROTULOS_STATUS[normalizarStatus(status)] || status || "—";
}

/**
 * Formata uma data ISO no padrão brasileiro (ex.: "29/09/2026 14:30").
 *
 * @param {string|null|undefined} data
 * @returns {string} Data formatada, ou "—" se ausente/inválida.
 */
export function formatarData(data) {
  if (!data) return "—";

  const objeto = new Date(data);

  if (Number.isNaN(objeto.getTime())) return "—";

  return objeto.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * Retorna a data de hoje no formato `AAAA-MM-DD` (fuso local), exigido
 * pelo atributo `min` de `<input type="date">`.
 *
 * @returns {string}
 */
export function dataDeHoje() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${agora.getFullYear()}-${mes}-${dia}`;
}
