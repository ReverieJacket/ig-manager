/**
 * Leitura do número de curtidas de uma publicação aberta no Instagram Web.
 *
 * O Instagram apresenta o contador de formas diferentes conforme o layout
 * (tamanho da janela, experimentos). Duas formas já foram vistas:
 *
 *  A) Texto completo: um botão "3 curtidas" (ou "3 likes").
 *  B) Barra de ações compacta: só o número, ao lado do ícone de coração
 *     (`<svg aria-label="Curtir">`), sem a palavra "curtidas".
 *
 * Nenhuma depende das classes ofuscadas do Instagram (`x1lliihq`...).
 */

/**
 * Executada DENTRO do navegador (via `page.evaluate`): não pode usar
 * variáveis ou módulos do Node. É exportada só para permitir testes.
 *
 * Estratégia A: elemento `role="button"` cujo texto inteiro é "<número>
 * curtidas|likes".
 *
 * Estratégia B: acha o coração DA PUBLICAÇÃO (o que está na mesma barra
 * de ações do ícone "Comentar"; os corações de cada comentário ficam fora
 * dela) e lê o primeiro `role="button"` só-numérico entre o coração e o
 * ícone "Comentar".
 *
 * Formatos de número: "3", "2.345" (milhar), "1,2 mil" e "1.2K"
 * (abreviados, portanto aproximados).
 *
 * @returns {{valor: number, aproximado: boolean, fonte: string}|null}
 *   `null` quando não há contador visível (por exemplo, o autor ocultou).
 */
function extrairCurtidasNoNavegador() {
    const MULTIPLICADOR = { mil: 1e3, k: 1e3, mi: 1e6, m: 1e6 };
    const NUMERO = /^(\d[\d.,]*)\s*(mil|mi|k|m)?$/i;
    const COM_PALAVRA = /^(\d[\d.,]*)\s*(mil|mi|k|m)?\s+(curtidas?|likes?)$/i;
    const ROTULO_CURTIR = /^(curtir|descurtir|like|unlike)$/i;
    const ROTULO_COMENTAR = /^(comentar|comment)$/i;

    const limpar = (texto) => texto.replace(/\s+/g, " ").trim();

    /** Converte "1,2 mil", "1.2K", "2.345" ou "3" em número. */
    function interpretar(numero, sufixo, fonte) {
        if (sufixo) {
            // Abreviado: o separador decimal pode ser vírgula ou ponto.
            const base = parseFloat(numero.replace(",", "."));

            return {
                valor: Math.round(base * MULTIPLICADOR[sufixo.toLowerCase()]),
                aproximado: true,
                fonte
            };
        }

        // Sem sufixo, pontos e vírgulas são separadores de milhar.
        return {
            valor: parseInt(numero.replace(/[.,]/g, ""), 10),
            aproximado: false,
            fonte
        };
    }

    const botoes = Array.from(document.querySelectorAll("[role='button']"));

    // Estratégia A: "<número> curtidas".
    for (const botao of botoes) {
        const m = limpar(botao.textContent).match(COM_PALAVRA);

        if (m) return interpretar(m[1], m[2], "texto");
    }

    // Estratégia B: número ao lado do coração.
    const icones = Array.from(document.querySelectorAll("svg[aria-label]"));
    const ehCurtir = (s) => ROTULO_CURTIR.test(s.getAttribute("aria-label").trim());
    const ehComentar = (s) => ROTULO_COMENTAR.test(s.getAttribute("aria-label").trim());

    for (const coracao of icones.filter(ehCurtir)) {
        // A barra de ações é um <section>; se o Instagram mudar isso, sobe-se
        // até o primeiro ancestral que contenha o ícone "Comentar" e só um coração.
        let barra = coracao.closest("section");

        if (!barra || !Array.from(barra.querySelectorAll("svg[aria-label]")).some(ehComentar)) {
            barra = coracao.parentElement;

            for (let nivel = 0; barra && nivel < 8; nivel++) {
                const svgs = Array.from(barra.querySelectorAll("svg[aria-label]"));

                if (svgs.some(ehComentar) && svgs.filter(ehCurtir).length === 1) break;

                barra = barra.parentElement;
            }
        }

        if (!barra) continue;

        const comentar = Array.from(barra.querySelectorAll("svg[aria-label]")).find(ehComentar);

        if (!comentar) continue; // coração de um comentário, não da publicação

        for (const botao of barra.querySelectorAll("[role='button']")) {
            // Só os que vêm DEPOIS do coração e ANTES do ícone "Comentar".
            const depoisDoCoracao = coracao.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING;
            const antesDeComentar = botao.compareDocumentPosition(comentar) & Node.DOCUMENT_POSITION_FOLLOWING;

            if (!depoisDoCoracao || !antesDeComentar) continue;
            if (botao.contains(coracao) || botao.contains(comentar)) continue;

            const m = limpar(botao.textContent).match(NUMERO);

            if (m) return interpretar(m[1], m[2], "icone");
        }
    }

    return null;
}

/**
 * Lê as curtidas na página atual.
 *
 * @param {import("playwright").Page} pagina - Página com a publicação aberta.
 * @returns {Promise<{valor: number, aproximado: boolean, fonte: string}|null>}
 *   `fonte` indica qual estratégia achou o número ("texto" ou "icone").
 */
function extrairCurtidas(pagina) {
    return pagina.evaluate(extrairCurtidasNoNavegador);
}

module.exports = { extrairCurtidas, extrairCurtidasNoNavegador };
