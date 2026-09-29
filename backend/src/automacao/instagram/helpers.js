/**
 * Funções auxiliares de interação com a página (Playwright).
 */
const fs = require("fs");
const path = require("path");

const { config } = require("../../config/env");
const { criarLogger } = require("../../lib/logger");

const log = criarLogger("Instagram");

/**
 * Salva uma captura de tela em `storage/logs` para diagnóstico.
 * Nunca lança erro: falhar ao registrar evidência não deve mascarar o
 * problema original.
 *
 * @param {import("playwright").Page} pagina
 * @param {string} prefixo - Identifica o motivo (ex.: "falha-publicacao").
 */
async function salvarScreenshot(pagina, prefixo) {
    try {
        fs.mkdirSync(config.diretorios.logs, { recursive: true });

        const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
        const arquivo = path.join(
            config.diretorios.logs,
            `${prefixo}-${carimbo}.png`
        );

        await pagina.screenshot({ path: arquivo, fullPage: true });
        log.info(`Screenshot salvo em: ${arquivo}`);
    } catch (erro) {
        log.erro(`Não foi possível salvar screenshot: ${erro.message}`);
    }
}

/**
 * Clica no primeiro elemento visível e habilitado de um Locator.
 * Útil porque o Instagram renderiza vários elementos com o mesmo nome,
 * muitos deles ocultos.
 *
 * @param {import("playwright").Locator} locator
 * @param {string} descricao - Nome usado nos logs.
 * @returns {Promise<boolean>} `true` se algum elemento foi clicado.
 */
async function clicarVisivel(locator, descricao) {
    try {
        const total = await locator.count();

        for (let i = 0; i < total; i++) {
            const elemento = locator.nth(i);

            if (
                (await elemento.isVisible().catch(() => false)) &&
                (await elemento.isEnabled().catch(() => false))
            ) {
                await elemento.click({ timeout: 5000 });
                log.info(`Elemento clicado: ${descricao}`);
                return true;
            }
        }
    } catch (erro) {
        log.erro(`Falha ao clicar em ${descricao}: ${erro.message}`);
    }

    return false;
}

module.exports = { log, salvarScreenshot, clicarVisivel };
