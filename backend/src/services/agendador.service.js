/**
 * Agendador: ponte entre as regras de negócio e o Publicador.
 *
 * As publicações não ficam mais em timers na memória: o Publicador
 * (`publicador/ciclo.js`) consulta o banco a cada 15 segundos e publica o
 * que venceu. Assim tanto faz se o site roda no computador ou na Vercel, e
 * nada se perde quando o processo reinicia.
 *
 * `agendar` apenas pede uma rodada imediata quando o Publicador roda neste
 * mesmo processo (modo "completo"); `cancelar` não precisa fazer nada,
 * porque o Publicador relê o status no banco antes de publicar.
 */

/** Uma publicação passou a valer (ou mudou de horário). */
function agendar() {
    const ciclo = require("../publicador/ciclo");
    ciclo.acordar();
}

/** Mantido por compatibilidade: o Publicador relê o banco antes de publicar. */
function cancelar() {}

module.exports = { agendar, cancelar };
