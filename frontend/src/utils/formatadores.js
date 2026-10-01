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

/**
 * Descreve quanto tempo se passou desde uma data, em português
 * (ex.: "há 5 minutos", "ontem"). Datas futuras/inválidas caem no formato
 * completo de `formatarData`.
 *
 * @param {string|null|undefined} data - Data ISO.
 * @returns {string}
 */
export function formatarDataRelativa(data) {
  if (!data) return "—";

  const instante = new Date(data).getTime();

  if (Number.isNaN(instante)) return "—";

  const segundos = Math.round((instante - Date.now()) / 1000);

  // Tolera pequena diferença de relógio; adiante disso mostra a data.
  if (segundos > 60) return formatarData(data);

  const formato = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const unidades = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unidade, tamanho] of unidades) {
    if (Math.abs(segundos) >= tamanho) {
      return formato.format(Math.round(segundos / tamanho), unidade);
    }
  }

  return "agora há pouco";
}

/**
 * Formata a quantidade de curtidas. Ausente (nunca lida ou oculta) aparece
 * como "—", e NÃO como 0, pois "sem dado" não é "zero curtidas". Valores
 * abreviados pelo Instagram ("1,2 mil") levam "~" na frente.
 *
 * @param {number|null|undefined} valor
 * @param {boolean} [aproximado=false]
 * @returns {string}
 */
export function formatarCurtidas(valor, aproximado = false) {
  if (valor === null || valor === undefined) return "—";

  return `${aproximado ? "~" : ""}${Number(valor).toLocaleString("pt-BR")}`;
}
