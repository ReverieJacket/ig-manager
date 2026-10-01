/**
 * Leitura do número de curtidas de uma publicação aberta no Instagram Web.
 *
 * Como nos comentários, não se usam as classes ofuscadas do Instagram: o
 * contador é um elemento com `role="button"` cujo texto é "<número>
 * curtidas" (ou "likes", na interface em inglês).
 */

/**
 * Executada DENTRO do navegador (via `page.evaluate`): não pode usar
 * variáveis ou módulos do Node. É exportada só para permitir testes.
 *
 * Formatos reconhecidos: "3 curtidas", "1 curtida", "2.345 curtidas" (milhar),
 * "1,2 mil curtidas" e "1.2K likes" (abreviados, portanto aproximados).
 *
 * @returns {{valor: number, aproximado: boolean}|null} `null` quando não há
 *   contador visível (por exemplo, o autor ocultou as curtidas).
 */
function extrairCurtidasNoNavegador() {
    const PADRAO = /^\s*(\d[\d.,]*)\s*(mil|mi|k|m)?\s+(curtidas?|likes?)\s*$/i;
    const MULTIPLICADOR = { mil: 1e3, k: 1e3, mi: 1e6, m: 1e6 };

    for (const elemento of document.querySelectorAll("[role='button']")) {
        const correspondencia = elemento.textContent
            .replace(/\s+/g, " ")
            .match(PADRAO);

        if (!correspondencia) continue;

        const [, numero, sufixo] = correspondencia;

        if (sufixo) {
            // Abreviado: o separador decimal pode ser vírgula ou ponto.
            const base = parseFloat(numero.replace(",", "."));

            return {
                valor: Math.round(base * MULTIPLICADOR[sufixo.toLowerCase()]),
                aproximado: true
            };
        }

        // Sem sufixo, pontos e vírgulas são separadores de milhar.
        return { valor: parseInt(numero.replace(/[.,]/g, ""), 10), aproximado: false };
    }

    return null;
}

/**
 * Lê as curtidas na página atual.
 *
 * @param {import("playwright").Page} pagina - Página com a publicação aberta.
 * @returns {Promise<{valor: number, aproximado: boolean}|null>}
 */
function extrairCurtidas(pagina) {
    return pagina.evaluate(extrairCurtidasNoNavegador);
}

module.exports = { extrairCurtidas, extrairCurtidasNoNavegador };
