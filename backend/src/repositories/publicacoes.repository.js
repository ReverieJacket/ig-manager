/**
 * Repositório de publicações (tabela `publicacoes`).
 *
 * Camada de acesso a dados: só conhece o PostgreSQL (via pg pool).
 * Todas as funções lançam o erro do pg em caso de falha.
 */
const { pool } = require("../lib/db");

/**
 * Ciclo de vida de uma publicação.
 * `agendada` -> `publicando` -> `publicada` | `erro`
 */
const STATUS = Object.freeze({
    AGENDADA: "agendada",
    PUBLICANDO: "publicando",
    PUBLICADA: "publicada",
    ERRO: "erro"
});

/**
 * Lista todas as publicações, da mais recente para a mais antiga.
 */
async function listar() {
    const { rows } = await pool.query(
        `SELECT * FROM publicacoes ORDER BY data_hora DESC`
    );
    return rows;
}

/**
 * Busca uma publicação pelo identificador.
 *
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function buscarPorId(id) {
    const { rows } = await pool.query(
        `SELECT * FROM publicacoes WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
}

/**
 * Insere uma nova publicação.
 *
 * @param {{conta_id: number, imagem: string, texto: string,
 *          data_hora: string, status: string, erro: (string|null)}} registro
 * @returns {Promise<object>} O registro criado (com `id`).
 */
async function criar(registro) {
    const colunas = Object.keys(registro);
    const valores = Object.values(registro);
    const placeholders = colunas.map((_, i) => `$${i + 1}`).join(", ");

    const { rows } = await pool.query(
        `INSERT INTO publicacoes (${colunas.join(", ")})
         VALUES (${placeholders})
         RETURNING *`,
        valores
    );
    return rows[0];
}

/**
 * Atualiza campos de uma publicação.
 *
 * @param {number} id
 * @param {object} campos - Colunas a alterar (ex.: `{ status, erro }`).
 * @returns {Promise<object>} O registro atualizado.
 */
async function atualizar(id, campos) {
    const chaves = Object.keys(campos);
    const valores = Object.values(campos);

    const sets = chaves.map((col, i) => `${col} = $${i + 1}`).join(", ");

    const { rows } = await pool.query(
        `UPDATE publicacoes SET ${sets} WHERE id = $${chaves.length + 1} RETURNING *`,
        [...valores, id]
    );
    return rows[0];
}

module.exports = { STATUS, listar, buscarPorId, criar, atualizar };
