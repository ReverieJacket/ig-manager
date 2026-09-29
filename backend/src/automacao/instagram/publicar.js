/**
 * Orquestra a publicação de uma imagem no Instagram via Playwright.
 *
 * Fluxo: abrir navegador -> restaurar sessão -> abrir "Criar" -> enviar
 * imagem -> avançar editor -> legenda -> Compartilhar -> aguardar
 * confirmação. Os passos ficam em `passos.js`.
 */
const fs = require("fs");
const { chromium } = require("playwright");

const { config, exigirVariaveis } = require("../../config/env");
const { log, salvarScreenshot } = require("./helpers");
const { restaurarSessao, verificarLogin } = require("./sessao");
const passos = require("./passos");
const { URL_INSTAGRAM, TEMPO } = require("./seletores");

/**
 * @typedef {Object} ResultadoPublicacao
 * @property {boolean} sucesso - `true` só com confirmação explícita do Instagram.
 * @property {boolean} incerto - `true` se o botão Compartilhar foi clicado mas o
 *   resultado não pôde ser confirmado (a publicação PODE ter ocorrido; não
 *   tente novamente sem conferir o perfil).
 * @property {string} mensagem - Descrição legível do resultado.
 * @property {string} [evidencia] - Indício usado (ou ausente) na confirmação.
 */

/**
 * Publica uma imagem com legenda usando a sessão salva do Instagram.
 * Nunca lança erro: falhas são devolvidas em `ResultadoPublicacao`.
 *
 * @param {string} caminhoImagem - Caminho absoluto da imagem no disco.
 * @param {string} legenda - Texto da publicação.
 * @param {string} [mimetype] - Tipo da imagem (apenas para log).
 * @returns {Promise<ResultadoPublicacao>}
 */
async function publicarNoInstagram(caminhoImagem, legenda, mimetype) {
    let navegador;
    let contexto;
    let pagina;
    let compartilhou = false;

    try {
        exigirVariaveis(["INSTAGRAM_USERNAME"]);

        if (!caminhoImagem || typeof caminhoImagem !== "string") {
            throw new Error("Caminho da imagem não informado.");
        }

        if (!fs.existsSync(caminhoImagem)) {
            throw new Error(`Imagem não encontrada: ${caminhoImagem}`);
        }

        if (typeof legenda !== "string") {
            throw new Error("A legenda deve ser um texto.");
        }

        log.info("Iniciando automação.");

        // headless: false — o Instagram bloqueia com mais frequência
        // navegadores sem interface.
        navegador = await chromium.launch({ headless: false });
        contexto = await navegador.newContext({
            viewport: { width: 1365, height: 900 }
        });

        await restaurarSessao(contexto);

        pagina = await contexto.newPage();
        pagina.setDefaultTimeout(TEMPO.padrao);

        pagina.on("pageerror", (erro) => {
            log.erro(`Erro da página: ${erro.message}`);
        });

        pagina.on("console", (mensagem) => {
            if (mensagem.type() === "error") {
                log.erro(`Erro de console: ${mensagem.text()}`);
            }
        });

        log.info("Abrindo Instagram.");

        await pagina.goto(URL_INSTAGRAM, {
            waitUntil: "domcontentloaded",
            timeout: TEMPO.navegacao
        });

        await pagina.waitForTimeout(3000);
        await verificarLogin(pagina);

        await passos.abrirCriarPost(pagina);

        log.info("Localizando campo de upload.");
        const campoUpload = await passos.localizarCampoUpload(pagina);

        log.info(`Enviando imagem${mimetype ? ` (${mimetype})` : ""}.`);
        await campoUpload.setInputFiles(caminhoImagem);

        await pagina.waitForTimeout(3000);
        await passos.avancarEditor(pagina);
        await passos.preencherLegenda(pagina, legenda);

        // Deve começar antes do clique, para não perder a resposta da API.
        const monitor = passos.monitorarCriacaoPost(pagina);

        log.info("Localizando botão Compartilhar.");
        const botaoCompartilhar = await passos.localizarBotaoCompartilhar(pagina);

        if (!botaoCompartilhar) {
            await salvarScreenshot(pagina, "compartilhar-nao-localizado");

            throw new Error(
                "Botão Compartilhar não encontrado. O envio não foi iniciado."
            );
        }

        log.info("Clicando em Compartilhar.");
        await botaoCompartilhar.click({ timeout: 10000 });
        compartilhou = true;

        const confirmacao = await passos.aguardarConfirmacao(pagina, monitor);

        log.info(`Desfecho: ${confirmacao.evidencia}`);

        if (confirmacao.confirmada) {
            await salvarScreenshot(pagina, "publicacao-confirmada");

            return {
                sucesso: true,
                incerto: false,
                mensagem: "Publicação confirmada pelo Instagram.",
                evidencia: confirmacao.evidencia
            };
        }

        if (confirmacao.falhou) {
            await salvarScreenshot(pagina, "publicacao-recusada");

            return {
                sucesso: false,
                incerto: false,
                mensagem: confirmacao.evidencia,
                evidencia: confirmacao.evidencia
            };
        }

        await salvarScreenshot(pagina, "publicacao-sem-confirmacao");

        return {
            sucesso: false,
            incerto: true,
            mensagem:
                "O botão Compartilhar foi acionado, mas não foi identificada " +
                "uma confirmação explícita do Instagram. Verifique o perfil " +
                "antes de tentar novamente.",
            evidencia: confirmacao.evidencia
        };
    } catch (erro) {
        log.erro(`Falha na automação: ${erro.message}`);

        if (pagina) {
            await salvarScreenshot(pagina, "falha-publicacao");
        }

        return {
            sucesso: false,
            incerto: compartilhou,
            mensagem: erro.message
        };
    } finally {
        if (contexto) await contexto.close().catch(() => {});
        if (navegador) await navegador.close().catch(() => {});

        log.info("Automação finalizada.");
    }
}

module.exports = { publicarNoInstagram };
