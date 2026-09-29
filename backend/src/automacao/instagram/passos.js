/**
 * Passos individuais do fluxo "criar publicação" no Instagram Web.
 *
 * Cada função faz uma única etapa e é orquestrada por `publicar.js`.
 */
const { config } = require("../../config/env");
const { log, salvarScreenshot, clicarVisivel } = require("./helpers");
const { verificarLogin } = require("./sessao");
const S = require("./seletores");

/**
 * Abre o perfil e aciona o botão "Criar" para iniciar uma nova publicação.
 *
 * @param {import("playwright").Page} pagina
 * @throws {Error} Se o botão não for localizado.
 */
async function abrirCriarPost(pagina) {
    log.info("Acessando o perfil.");

    await pagina.goto(`${S.URL_INSTAGRAM}${config.instagram.usuario}/`, {
        waitUntil: "domcontentloaded",
        timeout: S.TEMPO.navegacao
    });

    await pagina.waitForTimeout(4000);
    await verificarLogin(pagina);

    // Primeiro tenta o caminho que já funcionou anteriormente (menu lateral).
    try {
        const linkInicio = pagina.getByRole("link", {
            name: "Instagram",
            exact: true
        });

        if (await linkInicio.count()) {
            await linkInicio.first().hover({ timeout: 5000 });
            await pagina.waitForTimeout(1000);
        }

        const linkNovoPost = pagina.getByRole("link", {
            name: S.LINK_NOVO_POST
        });

        if (await clicarVisivel(linkNovoPost, S.LINK_NOVO_POST)) {
            await pagina.waitForTimeout(2000);
            return;
        }
    } catch (erro) {
        log.info(`Caminho anterior indisponível: ${erro.message}`);
    }

    for (const candidato of S.BOTOES_CRIAR) {
        if (await clicarVisivel(candidato.localizar(pagina), candidato.nome)) {
            await pagina.waitForTimeout(2000);
            return;
        }
    }

    await salvarScreenshot(pagina, "criar-nao-localizado");
    throw new Error("Não foi possível localizar o botão Criar.");
}

/**
 * Localiza o campo de upload de arquivo do editor.
 *
 * @param {import("playwright").Page} pagina
 * @returns {Promise<import("playwright").Locator>}
 * @throws {Error} Se nenhum campo for encontrado.
 */
async function localizarCampoUpload(pagina) {
    for (const seletor of S.CAMPOS_UPLOAD) {
        const campo = pagina.locator(seletor).first();

        try {
            await campo.waitFor({ state: "attached", timeout: 5000 });
            return campo;
        } catch {
            // Tenta o próximo seletor.
        }
    }

    await salvarScreenshot(pagina, "upload-nao-localizado");
    throw new Error("Campo de upload não encontrado.");
}

/**
 * Avança pelas etapas de edição (recorte/filtros). O Instagram apresenta
 * uma ou duas telas antes da legenda, por isso o botão é clicado até
 * duas vezes.
 *
 * @param {import("playwright").Page} pagina
 */
async function avancarEditor(pagina) {
    for (let etapa = 1; etapa <= 2; etapa++) {
        const avancar = pagina.getByRole("button", { name: S.BOTAO_AVANCAR });

        if (!(await clicarVisivel(avancar, `Avançar - etapa ${etapa}`))) {
            break;
        }

        await pagina.waitForTimeout(1800);
    }
}

/**
 * Preenche a legenda no primeiro campo de texto visível.
 *
 * @param {import("playwright").Page} pagina
 * @param {string} legenda
 * @throws {Error} Se nenhum campo de legenda for encontrado.
 */
async function preencherLegenda(pagina, legenda) {
    for (const localizar of S.CAMPOS_LEGENDA) {
        try {
            const locator = localizar(pagina);
            const total = await locator.count();

            for (let i = 0; i < total; i++) {
                const campo = locator.nth(i);

                if (await campo.isVisible().catch(() => false)) {
                    await campo.fill(legenda, { timeout: 5000 });
                    log.info("Legenda preenchida.");
                    return;
                }
            }
        } catch {
            // Tenta o próximo campo.
        }
    }

    await salvarScreenshot(pagina, "legenda-nao-localizada");
    throw new Error("Campo de legenda não encontrado.");
}

/**
 * Localiza o botão "Compartilhar" visível, se houver.
 *
 * @param {import("playwright").Page} pagina
 * @returns {Promise<import("playwright").Locator|null>}
 */
async function localizarBotaoCompartilhar(pagina) {
    const botao = pagina.getByRole("button", { name: S.BOTAO_COMPARTILHAR });
    const visivel = await botao.first().isVisible().catch(() => false);

    return visivel ? botao.first() : null;
}

/**
 * Passa a observar a resposta da API de criação de publicação.
 * Deve ser chamada ANTES de clicar em "Compartilhar".
 *
 * @param {import("playwright").Page} pagina
 * @returns {{resposta: (null|{httpStatus: number, status: (string|null),
 *            mensagem: (string|null)})}} Objeto atualizado quando a
 *   resposta chegar.
 */
function monitorarCriacaoPost(pagina) {
    const estado = { resposta: null };

    pagina.on("response", async (resposta) => {
        if (
            !S.URL_CRIACAO_POST.test(resposta.url()) ||
            resposta.request().method() !== "POST"
        ) {
            return;
        }

        let corpo = null;

        try {
            corpo = await resposta.json();
        } catch {
            // Corpo ausente ou não JSON: vale apenas o status HTTP.
        }

        estado.resposta = {
            httpStatus: resposta.status(),
            status: corpo?.status ?? null,
            mensagem: corpo?.message ?? null
        };

        log.debug("Resposta da criação de publicação", estado.resposta);
    });

    return estado;
}

/**
 * Procura na página a primeira mensagem que corresponda a um dos padrões.
 *
 * @param {import("playwright").Page} pagina
 * @param {RegExp[]} padroes
 * @returns {Promise<string|null>} O padrão encontrado, ou `null`.
 */
async function encontrarMensagem(pagina, padroes) {
    for (const padrao of padroes) {
        const mensagem = pagina.getByText(padrao).first();

        if (await mensagem.isVisible().catch(() => false)) {
            return String(padrao);
        }
    }

    return null;
}

/**
 * @typedef {Object} Confirmacao
 * @property {boolean} confirmada - Publicação confirmada.
 * @property {boolean} [falhou] - O Instagram recusou de forma explícita.
 * @property {string} evidencia - Sinal que decidiu o resultado (para log).
 */

/**
 * Aguarda o desfecho da publicação e encerra assim que houver um sinal
 * conclusivo, em ordem de confiabilidade:
 *
 * 1. Resposta da API de criação (`status: "ok"` = sucesso; erro = falha);
 * 2. Mensagem de sucesso na tela;
 * 3. Mensagem de erro na tela.
 *
 * O clique em "Compartilhar" sozinho, ou o modal fechar, NÃO contam como
 * sucesso. Sem nenhum sinal até `TEMPO.confirmacao`, o resultado é incerto.
 *
 * @param {import("playwright").Page} pagina
 * @param {{resposta: (object|null)}} estado - Retorno de `monitorarCriacaoPost`.
 * @returns {Promise<Confirmacao>}
 */
async function aguardarConfirmacao(pagina, estado) {
    log.info("Aguardando confirmação do Instagram.");

    const inicio = Date.now();

    while (Date.now() - inicio < S.TEMPO.confirmacao) {
        const api = estado.resposta;

        if (api) {
            if (api.httpStatus === 200 && api.status === "ok") {
                return {
                    confirmada: true,
                    evidencia: "Resposta da API do Instagram: status ok"
                };
            }

            if (api.httpStatus >= 400 || api.status === "fail") {
                return {
                    confirmada: false,
                    falhou: true,
                    evidencia:
                        `O Instagram recusou a publicação (HTTP ${api.httpStatus}` +
                        `${api.mensagem ? `: ${api.mensagem}` : ""}).`
                };
            }
        }

        const sucesso = await encontrarMensagem(pagina, S.MENSAGENS_SUCESSO);

        if (sucesso) {
            return {
                confirmada: true,
                evidencia: `Mensagem de sucesso na tela: ${sucesso}`
            };
        }

        const erro = await encontrarMensagem(pagina, S.MENSAGENS_ERRO);

        if (erro) {
            return {
                confirmada: false,
                falhou: true,
                evidencia: `Mensagem de erro na tela: ${erro}`
            };
        }

        await pagina.waitForTimeout(500);
    }

    return {
        confirmada: false,
        evidencia:
            "Nenhum sinal conclusivo de sucesso ou erro foi identificado no prazo."
    };
}

module.exports = {
    abrirCriarPost,
    localizarCampoUpload,
    avancarEditor,
    preencherLegenda,
    localizarBotaoCompartilhar,
    monitorarCriacaoPost,
    aguardarConfirmacao
};
