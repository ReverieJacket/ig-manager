/**
 * Constantes de domínio das publicações, compartilhadas pelas telas.
 * Concentrá-las aqui evita repetir strings e números "mágicos".
 */

/**
 * Status possíveis de uma publicação (mesmos valores gravados pelo backend).
 * `recusada` = indeferida pelo cliente (não será publicada); `cancelada` =
 * cancelada pelo administrador (aparece em "Todas"). `rascunho`
 * ainda não é gerado pelo backend.
 */
export const STATUS = Object.freeze({
  RASCUNHO: "rascunho",
  AGENDADA: "agendada",
  PUBLICANDO: "publicando",
  PUBLICADA: "publicada",
  ERRO: "erro",
  RECUSADA: "recusada",
  CANCELADA: "cancelada",
});

/** Texto exibido para cada status. */
export const ROTULOS_STATUS = Object.freeze({
  [STATUS.RASCUNHO]: "Rascunho",
  [STATUS.AGENDADA]: "Agendada",
  [STATUS.PUBLICANDO]: "Publicando",
  [STATUS.PUBLICADA]: "Publicada",
  [STATUS.ERRO]: "Com erro",
  [STATUS.RECUSADA]: "Recusada",
  [STATUS.CANCELADA]: "Cancelada",
});

/** Valor especial da aba que não filtra por status. */
export const FILTRO_TODAS = "todas";

/**
 * Aba/contador "Aguardando cliente": agendadas com aprovação pendente
 * (não é um status, é calculado em `usePublicacoes`).
 */
export const FILTRO_AGUARDANDO = "aguardando_cliente";

/** Resposta do cliente (coluna `aprovacao`). */
export const APROVACAO = Object.freeze({
  PENDENTE: "pendente",
  DEFERIDA: "deferida",
  INDEFERIDA: "indeferida",
});

/** Motivos do indeferimento (mesmas chaves do backend). */
export const CATEGORIAS_INDEFERIMENTO = Object.freeze([
  { valor: "texto", rotulo: "Texto / informação errada" },
  { valor: "imagem", rotulo: "Imagem" },
  { valor: "data", rotulo: "Data / horário" },
  { valor: "nao_quero", rotulo: "Não quero este post" },
]);

/** Abas de filtro da tela de postagens. */
export const ABAS_FILTRO = Object.freeze([
  { valor: FILTRO_TODAS, rotulo: "Todas" },
  { valor: STATUS.PUBLICADA, rotulo: "Publicadas" },
  { valor: STATUS.AGENDADA, rotulo: "Agendadas" },
  { valor: FILTRO_AGUARDANDO, rotulo: "Aguardando cliente" },
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
