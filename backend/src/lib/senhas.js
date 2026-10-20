/**
 * Hash e verificação de senhas com scrypt (módulo `crypto` do Node).
 *
 * scrypt é um algoritmo próprio para senhas (lento e caro em memória de
 * propósito, como o bcrypt) e já vem no Node, sem dependência nova.
 *
 * Formato gravado: `scrypt$N$r$p$<sal base64>$<hash base64>`. Guardar os
 * parâmetros junto permite endurecê-los no futuro sem invalidar as senhas
 * antigas.
 */
const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

const PARAMETROS = Object.freeze({ N: 16384, r: 8, p: 1 });
const TAMANHO_CHAVE = 64;
const TAMANHO_SAL = 16;

/** Regras mínimas de senha (validadas antes de gerar o hash). */
const SENHA_MIN = 8;
const SENHA_MAX = 128;

/**
 * Valida uma senha nova.
 *
 * @param {unknown} senha
 * @returns {string|null} Mensagem de erro, ou `null` se for válida.
 */
function validarSenhaNova(senha) {
    if (typeof senha !== "string" || senha.length < SENHA_MIN) {
        return `A senha deve ter pelo menos ${SENHA_MIN} caracteres.`;
    }
    if (senha.length > SENHA_MAX) {
        return `A senha deve ter no máximo ${SENHA_MAX} caracteres.`;
    }
    return null;
}

/**
 * Gera o hash de uma senha.
 *
 * @param {string} senha
 * @returns {Promise<string>}
 */
async function gerarHash(senha) {
    const sal = crypto.randomBytes(TAMANHO_SAL);
    const { N, r, p } = PARAMETROS;
    const chave = await scrypt(senha, sal, TAMANHO_CHAVE, { N, r, p });

    return ["scrypt", N, r, p, sal.toString("base64"), chave.toString("base64")].join("$");
}

/**
 * Confere uma senha com o hash gravado. Comparação em tempo constante.
 * Nunca lança: hash malformado = senha incorreta.
 *
 * @param {string} senha
 * @param {string} hashGravado
 * @returns {Promise<boolean>}
 */
async function conferirSenha(senha, hashGravado) {
    try {
        const [algoritmo, N, r, p, salB64, chaveB64] = String(hashGravado).split("$");

        if (algoritmo !== "scrypt" || !salB64 || !chaveB64) return false;

        const esperada = Buffer.from(chaveB64, "base64");
        const calculada = await scrypt(
            String(senha),
            Buffer.from(salB64, "base64"),
            esperada.length,
            { N: Number(N), r: Number(r), p: Number(p) }
        );

        return crypto.timingSafeEqual(calculada, esperada);
    } catch {
        return false;
    }
}

module.exports = { gerarHash, conferirSenha, validarSenhaNova, SENHA_MIN };
