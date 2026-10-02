/**
 * Extração de comentários de uma publicação aberta no Instagram Web.
 *
 * O Instagram gera nomes de classe ofuscados (`x1lliihq`, `_a6hd`...) que
 * mudam a cada atualização. Por isso a extração usa apenas atributos
 * estáveis: `href` dos links, `role`, `dir` e `<time datetime>`.
 */

/**
 * Executada DENTRO do navegador (via `page.evaluate`): não pode usar
 * variáveis ou módulos do Node. É exportada só para permitir testes.
 *
 * Como cada linha (comentário) é reconhecida:
 *  1. Cada `<time datetime>` marca um comentário ou a legenda.
 *  2. Sobe-se do `<time>` até o primeiro ancestral que contém o link do
 *     avatar (`a > img`): esse ancestral é a linha completa.
 *  3. Nome do perfil = texto do primeiro link de perfil com texto
 *     (o link do avatar não tem texto, só a imagem).
 *  4. Comentário = `span[dir="auto"]` da linha que NÃO é o nome, NÃO é a
 *     data e NÃO está em botão ("Reply") nem em link.
 *
 * @returns {Array<{tipo: string, perfil: string, comentario: string,
 *   data: string, id: (string|null), url: (string|null), oculto: boolean}>}
 */
function extrairNoNavegador() {
    const MARCADOR_OCULTO = /^\s*(hidden by instagram|oculto.*instagram)\s*$/i;

    // Marcador "Hidden by Instagram": comentários depois dele são ocultos.
    const marcadorOculto = Array.from(document.querySelectorAll("span")).find(
        (s) => s.children.length === 0 && MARCADOR_OCULTO.test(s.textContent)
    );

    const resultado = [];

    for (const tempo of document.querySelectorAll("time[datetime]")) {
        const link = tempo.closest("a");
        const href = link ? link.getAttribute("href") || "" : "";
        const ehComentario = /\/p\/[^/]+\/c\/\d+/.test(href);
        const ehLegenda = !link;

        // Ignora, por exemplo, a data do post (link para /p/<codigo>/).
        if (!ehComentario && !ehLegenda) continue;

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
        ).filter(
            (span) =>
                !span.closest("a") &&
                !span.closest("[role='button']") &&
                !span.contains(linkPerfil) &&
                !span.contains(tempo)
        );

        // Fica só com os mais externos (evita duplicar textos aninhados).
        const externos = candidatos.filter(
            (span) => !candidatos.some((outro) => outro !== span && outro.contains(span))
        );

        const texto = externos
            .map((span) => span.innerText.trim())
            .filter(Boolean)
            .join(" ");

        const partes = href.match(/\/p\/([^/]+)\/c\/(\d+)/);

        resultado.push({
            tipo: ehComentario ? "comentario" : "legenda",
            perfil: linkPerfil.textContent.trim(),
            comentario: texto,
            data: tempo.getAttribute("datetime"),
            id: partes ? partes[2] : null,
            url: ehComentario ? new URL(href, "https://www.instagram.com").href : null,
            oculto: Boolean(
                marcadorOculto &&
                (marcadorOculto.compareDocumentPosition(tempo) &
                    Node.DOCUMENT_POSITION_FOLLOWING)
            )
        });
    }

    return resultado;
}

/**
 * Lê os comentários visíveis na página atual.
 *
 * Só retorna o que já está carregado: o Instagram carrega mais comentários
 * ao rolar a lista ou clicar em "Ver mais comentários" (ver `coletar.js`).
 *
 * @param {import("playwright").Page} pagina - Página com a publicação aberta.
 * @returns {Promise<Array<object>>} Ver `extrairNoNavegador`.
 */
function extrairComentarios(pagina) {
    return pagina.evaluate(extrairNoNavegador);
}

module.exports = { extrairComentarios, extrairNoNavegador };
