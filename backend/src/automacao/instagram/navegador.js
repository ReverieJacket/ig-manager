/**
 * Abertura de uma sessão autenticada do Instagram no navegador.
 *
 * Reúne o que toda automação precisa antes de agir (abrir o navegador,
 * restaurar a sessão salva da conta, entrar no site e confirmar o login),
 * para que publicar e coletar comentários não repitam esse código.
 */
const { chromium } = require("playwright");

const { log, salvarScreenshot } = require("./helpers");
const { restaurarSessao, verificarLogin } = require("./sessao");
const { URL_INSTAGRAM, TEMPO } = require("./seletores");

/**
 * @typedef {Object} SessaoInstagram
 * @property {import("playwright").Page} pagina - Página já autenticada.
 * @property {() => Promise<void>} fechar - Encerra o navegador. Sempre
 *   deve ser chamada ao terminar (use `finally`).
 */

/**
 * Abre o Instagram com a sessão salva da conta informada.
 *
 * Se algo falhar no caminho (sessão ausente, login expirado), o navegador
 * é fechado antes de o erro ser lançado, e uma captura de tela é salva.
 *
 * @param {number} contaId - Id da conta (define qual arquivo de sessão usar).
 * @returns {Promise<SessaoInstagram>}
 * @throws {Error} Id inválido, sessão ausente/corrompida ou login pedido.
 */
async function abrirSessao(contaId) {
    const id = Number(contaId);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error("Informe o ID da conta do Instagram.");
    }

    // headless: false — o Instagram bloqueia com mais frequência
    // navegadores sem interface.
    const navegador = await chromium.launch({ headless: false });
    const fechar = () => navegador.close().catch(() => {});
    let pagina;

    try {
        const contexto = await navegador.newContext({
            viewport: { width: 1365, height: 900 }
        });

        await restaurarSessao(contexto, id);

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

        return { pagina, fechar };
    } catch (erro) {
        if (pagina) await salvarScreenshot(pagina, "falha-sessao");

        await fechar();
        throw erro;
    }
}

module.exports = { abrirSessao };
