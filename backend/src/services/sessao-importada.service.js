/**
 * Importar o arquivo de sessão do Instagram pelo site.
 *
 * Usado quando o backend roda num servidor sem tela (Oracle, EC2): o
 * administrador conecta o perfil no próprio computador com
 *
 *     npm run login:instagram -- --conta <id>
 *
 * e envia o arquivo gerado (`storage/instagram-sessoes/conta-<id>.json`)
 * em Clientes → ⋯ → "Enviar sessão". O servidor confere o arquivo e o
 * grava no mesmo lugar em que o "Conectar" gravaria.
 *
 * O arquivo dá acesso à conta do Instagram: é gravado só para o dono do
 * processo (permissão 600) e nunca é devolvido pela API.
 */
const fs = require("fs");
const path = require("path");

const { ErroHttp } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const { obterArquivoSessao } = require("../automacao/instagram/sessao");
const contasService = require("./contas.service");
const contasRepository = require("../repositories/contas.repository");

const log = criarLogger("SessaoImportada");

/** O cookie que prova que a sessão está logada no Instagram. */
const COOKIE_SESSAO = "sessionid";

/**
 * Lê e confere o conteúdo enviado.
 *
 * @param {Buffer|string} conteudo
 * @returns {{ estado: object, expiraEm: (Date|null) }}
 */
function validarConteudo(conteudo) {
    let estado;

    try {
        estado = JSON.parse(String(conteudo || "").replace(/^﻿/, ""));
    } catch {
        throw new ErroHttp(400, "O arquivo não é um JSON válido. Envie o conta-<id>.json gerado pelo login:instagram.");
    }

    if (!estado || typeof estado !== "object" || !Array.isArray(estado.cookies)) {
        throw new ErroHttp(400, "O arquivo não parece uma sessão do navegador (falta a lista de cookies).");
    }

    const sessao = estado.cookies.find(
        (c) =>
            c && c.name === COOKIE_SESSAO &&
            typeof c.value === "string" && c.value.length > 0 &&
            /(^|\.)instagram\.com$/i.test(String(c.domain || "").replace(/^\./, ""))
    );

    if (!sessao) {
        throw new ErroHttp(400, "O arquivo não tem uma sessão logada do Instagram. Faça o login de novo com o login:instagram e envie o arquivo gerado.");
    }

    // `expires` em segundos; -1 = cookie de sessão (sem data).
    const expira = Number(sessao.expires);
    const expiraEm = Number.isFinite(expira) && expira > 0 ? new Date(expira * 1000) : null;

    if (expiraEm && expiraEm.getTime() <= Date.now()) {
        throw new ErroHttp(400, "Esta sessão do Instagram já expirou. Faça o login de novo e envie o arquivo novo.");
    }

    // Só o que o Playwright usa: nada além de cookies e origens é gravado.
    return {
        estado: { cookies: estado.cookies, origins: Array.isArray(estado.origins) ? estado.origins : [] },
        expiraEm
    };
}

/**
 * Grava a sessão de um perfil a partir do arquivo enviado.
 *
 * @param {number} contaId
 * @param {Buffer} conteudo - Conteúdo do arquivo (JSON).
 * @returns {Promise<{ contaId: number, username: string, status: string, expiraEm: (string|null) }>}
 */
async function importar(contaId, conteudo) {
    const conta = await contasService.buscarContaAtiva(contaId);
    if (!conta) throw new ErroHttp(404, "Perfil não encontrado ou inativo.");

    const { estado, expiraEm } = validarConteudo(conteudo);

    const arquivo = obterArquivoSessao(conta.id);
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });

    // Grava num temporário e troca de uma vez: quem estiver publicando
    // nunca lê um arquivo pela metade.
    const temporario = `${arquivo}.${process.pid}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(estado), { mode: 0o600 });
    fs.renameSync(temporario, arquivo);

    await contasRepository.limparSessaoExpirada(conta.id).catch(() => {});
    log.info(`Sessão importada para @${conta.username}`, { contaId: conta.id });

    return {
        contaId: conta.id,
        username: conta.username,
        status: "conectado",
        expiraEm: expiraEm ? expiraEm.toISOString() : null
    };
}

module.exports = { importar, validarConteudo };
