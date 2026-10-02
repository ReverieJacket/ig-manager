/**
 * Extração de comentários, respostas e curtidas de comentários de uma
 * publicação aberta no Instagram Web.
 *
 * O Instagram gera nomes de classe ofuscados (`x1lliihq`, `_a6hd`...) que
 * mudam a cada atualização. Por isso a extração usa apenas atributos
 * estáveis: `href` dos links, `role`, `dir` e `<time datetime>`.
 */

/**
 * Executada DENTRO do navegador (via `page.evaluate`): não pode usar
 * variáveis ou módulos do Node. É exportada só para permitir testes.
 *
 * Como cada linha (comentário ou resposta) é reconhecida:
 *  1. Cada `<time datetime>` marca um comentário, uma resposta ou a legenda.
 *  2. Sobe-se do `<time>` até o primeiro ancestral que contém o link do
 *     avatar (`a > img`): esse ancestral é a linha completa.
 *  3. Nome do perfil = texto do primeiro link de perfil com texto
 *     (o link do avatar não tem texto, só a imagem).
 *  4. Texto = `span[dir="auto"]` da linha que NÃO é o nome, NÃO é a data e
 *     NÃO está em link nem em botão DENTRO da linha. (Botões que envolvem a
 *     linha inteira, vistos em um dos layouts, são ignorados.)
 *  5. Curtidas do comentário = elemento da linha cujo texto é exatamente
 *     "<número> curtidas|likes". O Instagram não exibe nada quando são 0.
 *
 * Identificação pelo link do `<time>`:
 *  - comentário: `/p/<post>/c/<comentario>/`
 *  - resposta:   `/p/<post>/c/<comentario-pai>/r/<resposta>/`
 *
 * @returns {Array<{tipo: ("legenda"|"comentario"|"resposta"), perfil: string,
 *   comentario: string, data: string, id: (string|null),
 *   paiId: (string|null), url: (string|null), oculto: boolean,
 *   curtidas: number, curtidasAproximado: boolean}>}
 */
function extrairNoNavegador() {
    const MARCADOR_OCULTO = /^\s*(hidden by instagram|oculto.*instagram)\s*$/i;
    const CURTIDAS = /^(\d[\d.,]*)\s*(mil|mi|k|m)?\s+(curtidas?|likes?)$/i;
    const MULTIPLICADOR = { mil: 1e3, k: 1e3, mi: 1e6, m: 1e6 };

    // Marcador "Hidden by Instagram": comentários depois dele são ocultos.
    const marcadorOculto = Array.from(document.querySelectorAll("span")).find(
        (s) => s.children.length === 0 && MARCADOR_OCULTO.test(s.textContent)
    );

    const resultado = [];

    for (const tempo of document.querySelectorAll("time[datetime]")) {
        const link = tempo.closest("a");
        const href = link ? link.getAttribute("href") || "" : "";
        const partes = href.match(/\/p\/[^/]+\/c\/(\d+)(?:\/r\/(\d+))?/);
        const ehLegenda = !link;

        // Ignora, por exemplo, a data do post (link para /p/<codigo>/).
        if (!partes && !ehLegenda) continue;

        // 2. Linha completa = primeiro ancestral que contém o avatar.
        let linha = tempo;

        while (linha && !linha.querySelector("a[href^='/'] > img")) {
            linha = linha.parentElement;
        }

        if (!linha) continue;

        // 3. Nome do perfil.
        const linkPerfil = Array.from(
            linha.querySelectorAll("a[href^='/']:not([href*='/p/'])")
        ).find((a) => a.textContent.trim() !== "");

        if (!linkPerfil) continue;

        // 4. Texto do comentário.
        const candidatos = Array.from(
            linha.querySelectorAll("span[dir='auto']")
        ).filter((span) => {
            const botao = span.closest("[role='button']");

            return (
                !span.closest("a") &&
                // Só conta botão DENTRO da linha (ex.: "Reply"); um botão
                // que envolve a linha toda não deve apagar o texto.
                !(botao && linha.contains(botao)) &&
                !span.contains(linkPerfil) &&
                !span.contains(tempo)
            );
        });

        // Fica só com os mais externos (evita duplicar textos aninhados).
        const externos = candidatos.filter(
            (span) => !candidatos.some((outro) => outro !== span && outro.contains(span))
        );

        const texto = externos
            .map((span) => span.innerText.trim())
            .filter(Boolean)
            .join(" ");

        // 5. Curtidas do comentário (fora do texto, para que um comentário
        //    que diga "2 curtidas" não seja confundido com o contador).
        let curtidas = 0;
        let curtidasAproximado = false;

        for (const el of linha.querySelectorAll("button, [role='button'], span")) {
            if (externos.some((t) => t.contains(el))) continue;

            const m = el.textContent.replace(/\s+/g, " ").trim().match(CURTIDAS);

            if (!m) continue;

            if (m[2]) {
                curtidas = Math.round(
                    parseFloat(m[1].replace(",", ".")) * MULTIPLICADOR[m[2].toLowerCase()]
                );
                curtidasAproximado = true;
            } else {
                curtidas = parseInt(m[1].replace(/[.,]/g, ""), 10);
            }

            break;
        }

        const ehResposta = Boolean(partes && partes[2]);

        resultado.push({
            tipo: ehLegenda ? "legenda" : ehResposta ? "resposta" : "comentario",
            perfil: linkPerfil.textContent.trim(),
            comentario: texto,
            data: tempo.getAttribute("datetime"),
            // Resposta: o próprio id é o da resposta; o do comentário pai vai em `paiId`.
            id: partes ? (partes[2] || partes[1]) : null,
            paiId: ehResposta ? partes[1] : null,
            url: partes ? new URL(href, "https://www.instagram.com").href : null,
            oculto: Boolean(
                marcadorOculto &&
                (marcadorOculto.compareDocumentPosition(tempo) &
                    Node.DOCUMENT_POSITION_FOLLOWING)
            ),
            curtidas,
            curtidasAproximado
        });
    }

    return resultado;
}

/**
 * Lê os comentários e respostas visíveis na página atual.
 *
 * Só retorna o que já está carregado: o Instagram carrega mais comentários
 * ao rolar a lista ou clicar em "carregar mais", e as respostas só aparecem
 * depois de clicar em "Ver respostas" (ver `coletar.js`).
 *
 * @param {import("playwright").Page} pagina - Página com a publicação aberta.
 * @returns {Promise<Array<object>>} Ver `extrairNoNavegador`.
 */
function extrairComentarios(pagina) {
    return pagina.evaluate(extrairNoNavegador);
}

module.exports = { extrairComentarios, extrairNoNavegador };
