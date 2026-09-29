/**
 * Sessão autenticada do Instagram.
 *
 * O login é feito manualmente uma vez (`npm run login:instagram`), que
 * grava o estado do navegador em `storage/instagram-auth.json`. Aqui esse
 * estado é reaplicado a cada execução da automação.
 */
const fs = require("fs");

const { config } = require("../../config/env");
const { log } = require("./helpers");
const { CAMPOS_LOGIN, URL_VERIFICACAO } = require("./seletores");

/**
 * Restaura cookies e localStorage do Instagram em um contexto novo.
 *
 * @param {import("playwright").BrowserContext} contexto
 * @throws {Error} Se o arquivo de sessão não existir ou estiver corrompido.
 */
async function restaurarSessao(contexto) {
    const arquivo = config.instagram.arquivoSessao;

    if (!fs.existsSync(arquivo)) {
        throw new Error(
            `Sessão não encontrada em ${arquivo}. ` +
            "Execute `npm run login:instagram` para gerá-la."
        );
    }

    let estado;

    try {
        estado = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    } catch (erro) {
        throw new Error(`Não foi possível ler a sessão: ${erro.message}`);
    }

    if (Array.isArray(estado.cookies) && estado.cookies.length) {
        await contexto.addCookies(estado.cookies);
        log.info("Cookies da sessão restaurados.");
    }

    const origemInstagram = estado.origins?.find(
        (origem) => origem.origin?.includes("instagram.com")
    );

    if (origemInstagram?.localStorage?.length) {
        // O localStorage só pode ser gravado com a página aberta; por isso
        // é injetado por um script executado antes de cada carregamento.
        await contexto.addInitScript((itens) => {
            for (const item of itens) {
                if (item?.name) {
                    localStorage.setItem(item.name, String(item.value ?? ""));
                }
            }
        }, origemInstagram.localStorage);

        log.info("Restauração do localStorage configurada.");
    }
}

/**
 * Confirma que a página não está na tela de login/verificação.
 *
 * @param {import("playwright").Page} pagina
 * @throws {Error} Se o Instagram pediu login ou verificação manual.
 */
async function verificarLogin(pagina) {
    if (URL_VERIFICACAO.test(pagina.url())) {
        throw new Error(
            "O Instagram solicitou login ou verificação manual. " +
            "Atualize a sessão antes de continuar."
        );
    }

    const campo = pagina.locator(CAMPOS_LOGIN).first();

    if (await campo.isVisible().catch(() => false)) {
        throw new Error(
            "A sessão não está autenticada. " +
            "Execute `npm run login:instagram` e tente novamente."
        );
    }

    log.info("Nenhum formulário de login identificado.");
}

module.exports = { restaurarSessao, verificarLogin };
