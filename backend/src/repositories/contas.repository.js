/**
 * Repositório de contas do Instagram (tabela `contas_instagram`).
 * Camada de acesso a dados: só conhece o PostgreSQL (via pg pool).
 */
const { pool } = require("../lib/db");

const COLUNAS = "id, nome, username, ativo, cliente";

async function listarAtivas() {
    const { rows } = await pool.query(
        `SELECT ${COLUNAS} FROM contas_instagram WHERE ativo = true ORDER BY id ASC`
    );
    return rows;
}

async function buscarPorId(id) {
    const { rows } = await pool.query(
        `SELECT ${COLUNAS} FROM contas_instagram WHERE id = $1`,
        [id]
    );
    return rows[0] || null;
}

async function buscarPorIds(ids) {
    if (ids.length === 0) return [];
    const { rows } = await pool.query(
        `SELECT id, nome, username FROM contas_instagram WHERE id = ANY($1)`,
        [ids]
    );
    return rows;
}

async function buscarPorUsername(username) {
    const { rows } = await pool.query(
        `SELECT ${COLUNAS} FROM contas_instagram WHERE username ILIKE $1`,
        [username]
    );
    return rows[0] || null;
}

async function criar(conta) {
    const { rows } = await pool.query(
        `INSERT INTO contas_instagram (nome, username, cliente, ativo)
         VALUES ($1, $2, $3, true)
         RETURNING ${COLUNAS}`,
        [conta.nome, conta.username, conta.cliente]
    );
    return rows[0];
}

async function criarConvite(convite) {
    const { rows } = await pool.query(
        `INSERT INTO convites_contas_instagram (cliente, token_hash, expires_at)
         VALUES ($1, $2, $3)
         RETURNING id, cliente, expires_at, created_at`,
        [convite.cliente, convite.token_hash, convite.expires_at]
    );
    return rows[0];
}

async function buscarConvitePorHash(tokenHash) {
    const { rows } = await pool.query(
        `SELECT id, cliente, expires_at, used_at
         FROM convites_contas_instagram
         WHERE token_hash = $1`,
        [tokenHash]
    );
    return rows[0] || null;
}

async function marcarConviteUtilizado(id) {
    const { rows } = await pool.query(
        `UPDATE convites_contas_instagram
         SET used_at = NOW()
         WHERE id = $1 AND used_at IS NULL
         RETURNING id`,
        [id]
    );
    return rows[0] || null;
}

module.exports = {
    listarAtivas,
    buscarPorId,
    buscarPorIds,
    buscarPorUsername,
    criar,
    criarConvite,
    buscarConvitePorHash,
    marcarConviteUtilizado
};
