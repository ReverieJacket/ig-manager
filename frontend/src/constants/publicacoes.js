/**
 * Constantes de domínio das publicações, compartilhadas pelas telas.
 * Concentrá-las aqui evita repetir strings e números "mágicos".
 */

/**
 * Status possíveis de uma publicação (mesmos valores gravados pelo backend).
 * `rascunho` e `recusada` ainda não são gerados pelo backend, mas já têm
 * abas e contadores na tela de postagens.
 */
export const STATUS = Object.freeze({
  RASCUNHO: "rascunho",
  AGENDADA: "agendada",
  PUBLICANDO: "publicando",
  PUBLICADA: "publicada",
  ERRO: "erro",
  RECUSADA: "recusada",
});

/** Texto exibido para cada status. */
export const ROTULOS_STATUS = Object.freeze({
  [STATUS.RASCUNHO]: "Rascunho",
  [STATUS.AGENDADA]: "Agendada",
  [STATUS.PUBLICANDO]: "Publicando",
  [STATUS.PUBLICADA]: "Publicada",
  [STATUS.ERRO]: "Com erro",
  [STATUS.RECUSADA]: "Recusada",
});

/** Valor especial da aba que não filtra por status. */
export const FILTRO_TODAS = "todas";

/** Abas de filtro da tela de postagens. */
export const ABAS_FILTRO = Object.freeze([
  { valor: FILTRO_TODAS, rotulo: "Todas" },
  { valor: STATUS.PUBLICADA, rotulo: "Publicadas" },
  { valor: STATUS.AGENDADA, rotulo: "Agendadas" },
  { valor: STATUS.RASCUNHO, rotulo: "Rascunhos" },
  { valor: STATUS.ERRO, rotulo: "Com erro" },
  { valor: STATUS.RECUSADA, rotulo: "Recusadas" },
]);

/** Regras da imagem enviada (o backend aceita até 15 MB; aqui somos mais restritos). */
export const IMAGEM = Object.freeze({
  tiposPermitidos: ["image/jpeg", "image/png", "image/webp"],
  tamanhoMaximoMb: 10,
});

/** Limite de caracteres da legenda do Instagram. */
export const LIMITE_LEGENDA = 2200;
