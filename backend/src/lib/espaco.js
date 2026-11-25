/**
 * Espaço atual da requisição (migração 012).
 *
 * Cada administrador que se cadastra ganha um espaço; clientes, perfis,
 * postagens, convites, pedidos e o Publicador pertencem a um espaço. O
 * middleware de autenticação abre o contexto com o espaço do usuário e os
 * repositórios usam `noEspaco`/`comEspaco` em toda consulta e gravação.
 *
 * Fora de uma requisição (Publicador local, scripts, modo "completo") não há
 * espaço no contexto e as consultas não são filtradas.
 */
const { AsyncLocalStorage } = require("node:async_hooks");

const armazenamento = new AsyncLocalStorage();

/**
 * Executa `fn` (e tudo o que ela chamar, inclusive de forma assíncrona) no
 * espaço informado.
 *
 * @template T
 * @param {number} espacoId
 * @param {() => T} fn
 * @returns {T}
 */
function noContexto(espacoId, fn) {
    if (!Number.isSafeInteger(Number(espacoId))) {
        throw new Error("Espaço inválido.");
    }
    return armazenamento.run({ espacoId: Number(espacoId) }, fn);
}

/** Espaço da requisição atual, ou `null` fora de uma requisição. */
function espacoAtual() {
    return armazenamento.getStore()?.espacoId ?? null;
}

/**
 * Restringe uma consulta do Supabase ao espaço atual.
 *
 * @param {object} consulta - Construtor de consulta (`supabase.from(...)...`).
 * @param {string} [coluna]
 */
function noEspaco(consulta, coluna = "espaco_id") {
    const id = espacoAtual();
    return id === null ? consulta : consulta.eq(coluna, id);
}

/**
 * Acrescenta o espaço atual ao registro que vai ser inserido. Fora de uma
 * requisição mantém o `espaco_id` já informado no registro.
 *
 * @param {object} registro
 */
function comEspaco(registro) {
    const id = espacoAtual();
    return id === null ? registro : { ...registro, espaco_id: id };
}

module.exports = { noContexto, espacoAtual, noEspaco, comEspaco };
