/**
 * Repositório de comentários (tabela `comentarios_instagram`).
 *
 * Camada de acesso a dados: só conhece o PostgreSQL (via pg pool).
 *
 * Respostas a comentários e curtidas de cada comentário dependem das colunas
 * criadas pela migração 003. `colunasDeRespostasDisponiveis` permite ao
 * serviço funcionar (sem esses dados) enquanto a migração não foi executada.
 */
const { pool } = require("../lib/db");

const TABELA = "comentarios_instagram";

/** Quantas linhas por requisição ao gravar (evita corpos gigantes). */
const TAMANHO_LOTE = 500;

const COLUNAS_BASE = "id, autor_username, texto, publicado_em, oculto, removido_em";
const COLUNAS_COM_RESPOSTAS = `${COLUNAS_BASE}, ig_comentario_id, ig_comentario_pai_id, eh_resposta, resposta_a_username, curtidas, curtidas_aproximado`;

/**
 * Verifica se a migração 003 (respostas e curtidas de comentários) já foi
 * executada, checando se as colunas existem na tabela.
 *
 * @returns {Promise<boolean>}
 */
async function colunasDeRespostasDisponiveis() {
    try {
        await pool.query(
            `SELECT ig_comentario_pai_id, resposta_a_username, eh_resposta, curtidas
             FROM ${TABELA} LIMIT 1`
        );
        return true;
    } catch (err) {
        if (err.code === "42703") return false; // coluna inexistente
        throw err;
    }
}

/**
 * Lista TODOS os comentários já guardados de uma publicação, apenas com o
 * necessário para comparar com uma nova coleta (inclui os removidos).
 *
 * @param {number} publicacaoId
 * @param {{comRespostas: boolean}} opcoes
 * @returns {Promise<Array>}
 */
async function listarParaSincronizar(publicacaoId, { comRespostas }) {
    const colunas = comRespostas
        ? "id, ig_comentario_id, ig_comentario_pai_id, removido_em"
        : "id, ig_comentario_id, removido_em";

    const { rows } = await pool.query(
        `SELECT ${colunas} FROM ${TABELA}
         WHERE publicacao_id = $1
         ORDER BY id ASC`,
        [publicacaoId]
    );
    return rows;
}

/**
 * Insere ou atualiza comentários (chave: publicacao_id + ig_comentario_id).
 * Requer UNIQUE constraint em (publicacao_id, ig_comentario_id).
 *
 * @param {Array<object>} linhas - Já com `publicacao_id` e `conta_id`.
 * @returns {Promise<void>}
 */
async function gravarLote(linhas) {
    if (linhas.length === 0) return;

    // Pega as colunas da primeira linha (todas devem ter a mesma estrutura).
    const colunas = Object.keys(linhas[0]);
    const colunasStr = colunas.join(", ");

    // Colunas a atualizar no ON CONFLICT (todas exceto as de conflito).
    const colunasConflito = ["publicacao_id", "ig_comentario_id"];
    const colunasUpdate = colunas.filter((c) => !colunasConflito.includes(c));
    const updateStr = colunasUpdate
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(", ");

    for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
        const lote = linhas.slice(i, i + TAMANHO_LOTE);
        const valores = [];
        const linhasPlaceholders = [];

        lote.forEach((linha, idx) => {
            const offset = idx * colunas.length;
            const phs = colunas.map((_, j) => `$${offset + j + 1}`);
            linhasPlaceholders.push(`(${phs.join(", ")})`);
            colunas.forEach((col) => valores.push(linha[col]));
        });

        await pool.query(
            `INSERT INTO ${TABELA} (${colunasStr})
             VALUES ${linhasPlaceholders.join(", ")}
             ON CONFLICT (publicacao_id, ig_comentario_id)
             DO UPDATE SET ${updateStr}`,
            valores
        );
    }
}

/**
 * Marca comentários como removidos (não apaga).
 *
 * @param {number[]} ids - Ids das linhas no banco.
 * @param {string} quando - Instante ISO da detecção.
 * @returns {Promise<void>}
 */
async function marcarRemovidos(ids, quando) {
    for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
        const lote = ids.slice(i, i + TAMANHO_LOTE);
        await pool.query(
            `UPDATE ${TABELA} SET removido_em = $1 WHERE id = ANY($2)`,
            [quando, lote]
        );
    }
}

/**
 * Conta os comentários ativos (não removidos) de uma publicação.
 *
 * @param {number} publicacaoId
 * @returns {Promise<number>}
 */
async function contarAtivos(publicacaoId) {
    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM ${TABELA}
         WHERE publicacao_id = $1 AND removido_em IS NULL`,
        [publicacaoId]
    );
    return rows[0].total;
}

/**
 * Conta as respostas de uma publicação (exige a migração 003).
 *
 * @param {number} publicacaoId
 * @param {boolean} incluirRemovidos
 * @returns {Promise<number>}
 */
async function contarRespostas(publicacaoId, incluirRemovidos) {
    const filtroRemovidos = incluirRemovidos ? "" : " AND removido_em IS NULL";

    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS total FROM ${TABELA}
         WHERE publicacao_id = $1
           AND ig_comentario_pai_id IS NOT NULL
           ${filtroRemovidos}`,
        [publicacaoId]
    );
    return rows[0].total;
}

/**
 * Lista os comentários de uma publicação com paginação.
 *
 * @param {number} publicacaoId
 * @param {{limite: number, deslocamento: number, incluirRemovidos: boolean,
 *   comRespostas: boolean}} opcoes
 * @returns {Promise<{itens: object[], total: number}>}
 */
async function listarPorPublicacao(
    publicacaoId,
    { limite, deslocamento, incluirRemovidos, comRespostas }
) {
    const colunas = comRespostas ? COLUNAS_COM_RESPOSTAS : COLUNAS_BASE;

    const condicoes = ["publicacao_id = $1"];
    if (comRespostas) condicoes.push("ig_comentario_pai_id IS NULL");
    if (!incluirRemovidos) condicoes.push("removido_em IS NULL");

    const where = condicoes.join(" AND ");

    // Buscar itens e total em paralelo.
    const [dataResult, countResult] = await Promise.all([
        pool.query(
            `SELECT ${colunas} FROM ${TABELA}
             WHERE ${where}
             ORDER BY publicado_em DESC, id DESC
             LIMIT $2 OFFSET $3`,
            [publicacaoId, limite, deslocamento]
        ),
        pool.query(
            `SELECT COUNT(*)::int AS total FROM ${TABELA} WHERE ${where}`,
            [publicacaoId]
        )
    ]);

    return {
        itens: dataResult.rows,
        total: countResult.rows[0].total
    };
}

/**
 * Lista as respostas dos comentários informados, na ordem da conversa.
 * Exige a migração 003.
 *
 * @param {number} publicacaoId
 * @param {string[]} paiIds - `ig_comentario_id` dos comentários principais.
 * @param {boolean} incluirRemovidos
 * @returns {Promise<object[]>}
 */
async function listarRespostas(publicacaoId, paiIds, incluirRemovidos) {
    if (paiIds.length === 0) return [];

    const filtroRemovidos = incluirRemovidos ? "" : " AND removido_em IS NULL";

    const { rows } = await pool.query(
        `SELECT ${COLUNAS_COM_RESPOSTAS} FROM ${TABELA}
         WHERE publicacao_id = $1
           AND ig_comentario_pai_id = ANY($2)
           ${filtroRemovidos}
         ORDER BY publicado_em ASC, id ASC`,
        [publicacaoId, paiIds]
    );
    return rows;
}

module.exports = {
    colunasDeRespostasDisponiveis,
    listarParaSincronizar,
    gravarLote,
    marcarRemovidos,
    contarAtivos,
    contarRespostas,
    listarPorPublicacao,
    listarRespostas
};
