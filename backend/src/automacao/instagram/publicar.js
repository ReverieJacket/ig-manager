/**
 * Orquestra a publicação de uma imagem no Instagram via Playwright.
 *
 * Fluxo: abrir sessão da conta -> abrir "Criar" -> enviar imagem ->
 * avançar editor -> legenda -> Compartilhar -> aguardar confirmação.
 * Os passos ficam em `passos.js`; a abertura da sessão em `navegador.js`.
 */
const fs = require("fs");

const { log, salvarScreenshot } = require("./helpers");
const { abrirSessao } = require("./navegador");
const passos = require("./passos");

/**
 * @typedef {Object} ResultadoPublicacao
 * @property {boolean} sucesso - `true` só com confirmação explícita do Instagram.
 * @property {boolean} incerto - `true` se o botão Compartilhar foi clicado mas o
 *   resultado não pôde ser confirmado (a publicação PODE ter ocorrido; não
 *   tente novamente sem conferir o perfil).
 * @property {string} mensagem - Descrição legível do resultado.
 * @property {string} [evidencia] - Indício usado (ou ausente) na confirmação.
 * @property {string|null} [codigoPost] - Código curto do post no Instagram
 *   (o trecho de `instagram.com/p/<codigo>/`), quando informado pela API.
 *   Necessário depois para coletar os comentários.
 */

/**
 * Publica uma imagem com legenda usando a sessão salva da conta.
 * Nunca lança erro: falhas são devolvidas em `ResultadoPublicacao`.
 *
 * @param {string} caminhoImagem - Caminho absoluto da imagem no disco.
 * @param {string} legenda - Texto da publicação.
 * @param {string} [mimetype] - Tipo da imagem (apenas para log).
 * @param {number} contaId - ID da conta cuja sessão será utilizada.
 * @param {string} username - Usuário da conta (sem @); o perfil aberto na automação.
 * @returns {Promise<ResultadoPublicacao>}
 */
async function publicarNoInstagram(
    caminhoImagem,
    legenda,
    mimetype,
    contaId,
    username
) {
    let sessao;
    let pagina;
    let compartilhou = false;

    try {
        if (!Number.isSafeInteger(Number(contaId)) || Number(contaId) <= 0) {
            throw new Error("Informe o ID da conta do Instagram para publicar.");
        }

        if (!username || typeof username !== "string") {
            throw new Error("Informe o usuário da conta do Instagram para publicar.");
        }

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

        sessao = await abrirSessao(contaId);
        pagina = sessao.pagina;

        await passos.abrirCriarPost(pagina, username);

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
                evidencia: confirmacao.evidencia,
                codigoPost: monitor.resposta?.codigo ?? null
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
        if (sessao) await sessao.fechar();

        log.info("Automação finalizada.");
    }
}

module.exports = { publicarNoInstagram };
