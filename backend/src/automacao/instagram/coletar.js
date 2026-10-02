/**
 * Coleta dos comentários de UMA publicação, usando a sessão da conta.
 *
 * Fluxo: abrir sessão -> abrir `instagram.com/p/<codigo>/` -> rolar e
 * clicar em "carregar mais" até a lista parar de crescer -> extrair.
 *
 * Só lê; nunca escreve nada no Instagram.
 */
const { log, salvarScreenshot, clicarVisivel } = require("./helpers");
const { abrirSessao } = require("./navegador");
const { verificarLogin } = require("./sessao");
const { extrairComentarios } = require("./comentarios");
const { extrairCurtidas } = require("./curtidas");
const {
    URL_INSTAGRAM,
    TEMPO,
    BOTOES_CARREGAR_COMENTARIOS,
    COLETA,
    FORMATO_CODIGO_POST
} = require("./seletores");

/** Localizador dos horários de comentários já carregados na tela. */
const HORARIOS_COMENTARIOS = 'a[href*="/c/"] time[datetime]';

/** Pausa curta e variável, para não agir em intervalos idênticos. */
function pausa(pagina, baseMs) {
    return pagina.waitForTimeout(baseMs + Math.floor(Math.random() * baseMs));
}

/**
 * Carrega o máximo possível de comentários rolando a lista e clicando em
 * "carregar mais" até que a quantidade pare de crescer.
 *
 * @param {import("playwright").Page} pagina
 * @returns {Promise<{completa: boolean, rodadas: number}>} `completa` é
 *   `true` só quando a lista parou de crescer; se o limite de rodadas
 *   acabou antes, pode haver comentários não carregados.
 */
async function carregarTodosComentarios(pagina) {
    let anterior = -1;
    let estaveis = 0;

    for (let rodada = 1; rodada <= COLETA.maximoRodadas; rodada++) {
        const horarios = pagina.locator(HORARIOS_COMENTARIOS);
        const total = await horarios.count();

        if (total > 0) {
            // Levar o último comentário à vista aciona o carregamento preguiçoso.
            await horarios.last().scrollIntoViewIfNeeded().catch(() => {});
        }

        let clicou = false;

        for (const localizar of BOTOES_CARREGAR_COMENTARIOS) {
            if (await clicarVisivel(localizar(pagina), "carregar mais comentários")) {
                clicou = true;
                break;
            }
        }

        await pausa(pagina, 900);

        const depois = await pagina.locator(HORARIOS_COMENTARIOS).count();

        log.debug("Rodada de carregamento de comentários", { rodada, antes: total, depois, clicou });

        estaveis = depois === anterior && !clicou ? estaveis + 1 : 0;
        anterior = depois;

        if (estaveis >= COLETA.rodadasEstaveisParaConcluir) {
            return { completa: true, rodadas: rodada };
        }
    }

    return { completa: false, rodadas: COLETA.maximoRodadas };
}

/**
 * @typedef {Object} ResultadoColeta
 * @property {Array<object>} comentarios - Comentários (sem a legenda), no
 *   formato de `extrairComentarios`.
 * @property {boolean} completa - A lista foi carregada até o fim.
 * @property {{valor: number, aproximado: boolean}|null} curtidas - Curtidas
 *   lidas na mesma visita; `null` se o contador não estava visível.
 */

/**
 * Coleta os comentários de uma publicação.
 *
 * @param {number} contaId - Conta cuja sessão será usada.
 * @param {string} codigoPost - Código curto do post no Instagram.
 * @returns {Promise<ResultadoColeta>}
 * @throws {Error} Código inválido, sessão ausente/expirada ou falha ao abrir o post.
 */
async function coletarComentariosDoPost(contaId, codigoPost) {
    if (!FORMATO_CODIGO_POST.test(String(codigoPost || ""))) {
        throw new Error("Código do post inválido.");
    }

    const sessao = await abrirSessao(contaId);
    const { pagina } = sessao;

    try {
        log.info(`Abrindo o post ${codigoPost} para coletar comentários.`);

        await pagina.goto(`${URL_INSTAGRAM}p/${codigoPost}/`, {
            waitUntil: "domcontentloaded",
            timeout: TEMPO.navegacao
        });

        await pagina.waitForTimeout(4000);
        await verificarLogin(pagina);

        const { completa, rodadas } = await carregarTodosComentarios(pagina);
        const todos = await extrairComentarios(pagina);

        // Mesma visita ao post: o contador de curtidas não custa outra abertura.
        const curtidas = await extrairCurtidas(pagina);

        // Sem contador: guarda uma imagem para entender o que o Instagram mostrou.
        if (!curtidas) await salvarScreenshot(pagina, "curtidas-nao-encontradas");

        // A legenda aparece na lista, mas não é um comentário.
        const comentarios = todos.filter((c) => c.tipo === "comentario" && c.id);

        log.info("Coleta de comentários concluída", {
            codigoPost,
            total: comentarios.length,
            curtidas: curtidas?.valor ?? null,
            curtidasFonte: curtidas?.fonte ?? null,
            completa,
            rodadas
        });

        return { comentarios, completa, curtidas };
    } catch (erro) {
        await salvarScreenshot(pagina, "falha-coleta-comentarios");
        throw erro;
    } finally {
        await sessao.fechar();
    }
}

module.exports = { coletarComentariosDoPost, carregarTodosComentarios };
