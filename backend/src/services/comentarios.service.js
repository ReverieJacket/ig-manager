/**
 * Serviço de comentários das publicações.
 *
 * Coleta (via automação), sincroniza com o banco sem perder histórico e
 * expõe a listagem paginada para a API.
 */
const { ErroHttp, formatarErro } = require("../lib/erros");
const { filaAutomacao } = require("../lib/fila");
const { criarLogger } = require("../lib/logger");
const { coletarComentariosDoPost } = require("../automacao/instagram/coletar");
const comentariosRepository = require("../repositories/comentarios.repository");
const curtidasRepository = require("../repositories/curtidas.repository");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const { planejarSincronizacao } = require("./comentarios.sincronizacao");

const { STATUS } = publicacoesRepository;
const log = criarLogger("Comentarios");

/**
 * Guarda as curtidas lidas na coleta: valor atual na publicação e uma linha
 * no histórico. É "melhor esforço": se a migração 002 ainda não foi
 * executada ou a gravação falhar, apenas avisa, pois os comentários já
 * foram sincronizados e não devem ser perdidos por causa disso.
 *
 * Contador não encontrado (curtidas ocultas pelo autor) NÃO zera o valor
 * anterior: "sem dado" é diferente de "zero curtidas".
 *
 * @param {object} publicacao
 * @param {{valor: number, aproximado: boolean}|null} curtidas
 * @param {string} agora - Instante ISO da coleta.
 * @returns {Promise<{valor: number, aproximado: boolean}|null>} O que foi
 *   gravado, ou `null` se não houve leitura.
 */
async function registrarCurtidas(publicacao, curtidas, agora) {
    if (!curtidas) {
        log.aviso(
            `Publicação ${publicacao.id}: contador de curtidas não encontrado ` +
            "(talvez oculto pelo autor); o valor anterior foi mantido."
        );
        return null;
    }

    try {
        await publicacoesRepository.atualizar(publicacao.id, {
            curtidas: curtidas.valor,
            curtidas_aproximado: curtidas.aproximado,
            curtidas_atualizado_em: agora
        });

        await curtidasRepository.registrarHistorico({
            publicacaoId: publicacao.id,
            contaId: publicacao.conta_id,
            curtidas: curtidas.valor,
            aproximado: curtidas.aproximado,
            coletadoEm: agora
        });

        return curtidas;
    } catch (erro) {
        log.aviso(
            `Publicação ${publicacao.id}: não foi possível guardar as curtidas ` +
            "(a migração 002_curtidas.sql foi executada?)",
            formatarErro(erro)
        );
        return null;
    }
}

/**
 * Lista os comentários PRINCIPAIS de uma publicação (paginado), cada um com
 * suas respostas aninhadas em `respostas` (da mais antiga para a mais nova).
 *
 * `total` conta só os principais (é o que a paginação usa); `total_respostas`
 * conta as respostas.
 *
 * @param {number} publicacaoId
 * @param {{limite: number, pagina: number, incluirRemovidos: boolean}} opcoes
 * @returns {Promise<{total: number, total_respostas: number, pagina: number,
 *   limite: number, atualizado_em: (string|null), itens: object[]}>}
 * @throws {ErroHttp} 404 se a publicação não existir.
 */
async function listarComentarios(publicacaoId, { limite, pagina, incluirRemovidos }) {
    const publicacao = await publicacoesRepository.buscarPorId(publicacaoId);

    if (!publicacao) throw new ErroHttp(404, "Publicação não encontrada.");

    // Sem a migração 003, lista como antes (sem respostas nem curtidas).
    const comRespostas = await comentariosRepository.colunasDeRespostasDisponiveis();

    const { itens, total } = await comentariosRepository.listarPorPublicacao(
        publicacaoId,
        { limite, deslocamento: (pagina - 1) * limite, incluirRemovidos, comRespostas }
    );

    let totalRespostas = 0;
    let comentarios;

    if (comRespostas) {
        const respostas = await comentariosRepository.listarRespostas(
            publicacaoId,
            itens.map((item) => item.ig_comentario_id),
            incluirRemovidos
        );

        const porPai = new Map();

        for (const resposta of respostas) {
            const lista = porPai.get(resposta.ig_comentario_pai_id) || [];

            lista.push(resposta);
            porPai.set(resposta.ig_comentario_pai_id, lista);
        }

        comentarios = itens.map((item) => ({
            ...item,
            respostas: porPai.get(item.ig_comentario_id) || []
        }));

        totalRespostas = await comentariosRepository.contarRespostas(
            publicacaoId,
            incluirRemovidos
        );
    } else {
        comentarios = itens.map((item) => ({
            ...item,
            curtidas: 0,
            curtidas_aproximado: false,
            respostas: []
        }));
    }

    return {
        total,
        total_respostas: totalRespostas,
        pagina,
        limite,
        atualizado_em: publicacao.comentarios_atualizado_em ?? null,
        itens: comentarios
    };
}

/**
 * Coleta os comentários atuais da publicação no Instagram e os sincroniza
 * com o banco. Roda na fila da automação (um navegador por vez).
 *
 * @param {number} publicacaoId
 * @returns {Promise<{novos: number, novas_respostas: number,
 *   reaparecidos: number, removidos: number, total: number,
 *   completa: boolean, respostas_completas: boolean, curtidas: (number|null),
 *   curtidas_aproximado: boolean}>} `total` inclui as respostas.
 * @throws {ErroHttp} 404 (publicação inexistente), 409 (publicação sem
 *   código do post ou ainda não publicada), 502 (falha ao acessar o Instagram).
 */
async function coletarComentarios(publicacaoId) {
    const publicacao = await publicacoesRepository.buscarPorId(publicacaoId);

    if (!publicacao) throw new ErroHttp(404, "Publicação não encontrada.");

    if (publicacao.status !== STATUS.PUBLICADA) {
        throw new ErroHttp(409, "Só é possível coletar comentários de publicações já publicadas.");
    }

    if (!publicacao.ig_codigo) {
        throw new ErroHttp(
            409,
            "Esta publicação não tem o código do post no Instagram. " +
            "Informe-o em PATCH /publicacoes/:id/instagram."
        );
    }

    let coleta;

    try {
        coleta = await filaAutomacao.executar(() =>
            coletarComentariosDoPost(publicacao.conta_id, publicacao.ig_codigo)
        );
    } catch (erro) {
        log.erro(`Falha ao coletar comentários da publicação ${publicacaoId}`, formatarErro(erro));

        throw new ErroHttp(502, `Não foi possível coletar os comentários: ${formatarErro(erro)}`);
    }

    const agora = new Date().toISOString();
    const comRespostas = await comentariosRepository.colunasDeRespostasDisponiveis();

    let coletados = coleta.comentarios;

    if (!comRespostas) {
        log.aviso(
            "Migração 003_respostas_e_curtidas_de_comentarios.sql pendente (ou desatualizada: " +
            "execute-a de novo): as respostas e as curtidas dos comentários NÃO serão guardadas."
        );

        // Sem a coluna do pai, uma resposta viraria um comentário solto e confuso.
        coletados = coletados.filter((c) => c.tipo !== "resposta");
    }

    const existentes = await comentariosRepository.listarParaSincronizar(
        publicacaoId,
        { comRespostas }
    );
    const plano = planejarSincronizacao(
        existentes,
        coletados,
        coleta.completa,
        coleta.respostasCompletas ?? coleta.completa
    );

    await comentariosRepository.gravarLote(
        plano.gravar.map((linha) => {
            // Sem a migração, não se enviam as colunas que ainda não existem.
            const {
                ig_comentario_pai_id: _pai,
                resposta_a_username: _respondido,
                curtidas: _curtidas,
                curtidas_aproximado: _aproximado,
                ...base
            } = linha;

            return {
                ...(comRespostas ? linha : base),
                publicacao_id: publicacaoId,
                conta_id: publicacao.conta_id,
                ultima_vez_visto_em: agora
            };
        })
    );

    if (plano.removerIds.length > 0) {
        await comentariosRepository.marcarRemovidos(plano.removerIds, agora);
    }

    const total = await comentariosRepository.contarAtivos(publicacaoId);

    await publicacoesRepository.atualizar(publicacaoId, {
        comentarios_total: total,
        comentarios_atualizado_em: agora
    });

    const curtidas = await registrarCurtidas(publicacao, coleta.curtidas, agora);

    log.info(`Comentários da publicação ${publicacaoId} sincronizados`, {
        novos: plano.novos,
        novasRespostas: plano.novasRespostas,
        reaparecidos: plano.reaparecidos,
        removidos: plano.removidos,
        total,
        completa: coleta.completa,
        respostasCompletas: coleta.respostasCompletas ?? coleta.completa,
        curtidas: curtidas?.valor ?? null,
        removocoesIgnoradas: plano.removocoesIgnoradas
    });

    return {
        novos: plano.novos,
        novas_respostas: plano.novasRespostas,
        reaparecidos: plano.reaparecidos,
        removidos: plano.removidos,
        total,
        completa: coleta.completa,
        respostas_completas: coleta.respostasCompletas ?? coleta.completa,
        curtidas: curtidas?.valor ?? null,
        curtidas_aproximado: curtidas?.aproximado ?? false
    };
}

/**
 * Define o código do post no Instagram de uma publicação (útil para posts
 * criados antes de o sistema guardar esse código automaticamente).
 *
 * @param {number} publicacaoId
 * @param {string} codigo - Código curto do post, já validado.
 * @returns {Promise<object>} Publicação atualizada.
 * @throws {ErroHttp} 404 se a publicação não existir.
 */
async function definirCodigoPost(publicacaoId, codigo) {
    const publicacao = await publicacoesRepository.buscarPorId(publicacaoId);

    if (!publicacao) throw new ErroHttp(404, "Publicação não encontrada.");

    return publicacoesRepository.atualizar(publicacaoId, { ig_codigo: codigo });
}

module.exports = { listarComentarios, coletarComentarios, definirCodigoPost };
