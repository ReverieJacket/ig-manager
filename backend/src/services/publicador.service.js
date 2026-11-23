/**
 * Serviço que executa uma publicação já registrada no banco.
 *
 * Coordena três coisas: o status no banco, a conta vinculada e a
 * automação do Instagram. É chamado tanto pelo envio imediato quanto
 * pelo agendador.
 */
const { criarLogger } = require("../lib/logger");
const { formatarErro } = require("../lib/erros");
const { caminhoLocal } = require("../lib/imagens");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const contasService = require("./contas.service");
const contasRepository = require("../repositories/contas.repository");

const { STATUS } = publicacoesRepository;
const log = criarLogger("Publicador");

/**
 * @typedef {Object} ResultadoExecucao
 * @property {boolean} sucesso
 * @property {number} id - Identificador da publicação.
 * @property {boolean} [resultadoIncerto] - Ver `incerto` em `ResultadoPublicacao`.
 * @property {string} [mensagem] - Descrição do erro, quando `sucesso` é `false`.
 */

/**
 * Marca a publicação com erro, sem nunca lançar exceção (para que uma
 * falha ao gravar o erro não esconda o erro original).
 *
 * @param {number} id
 * @param {string} mensagem
 */
async function registrarErro(id, mensagem) {
    try {
        await publicacoesRepository.atualizar(id, {
            status: STATUS.ERRO,
            erro: mensagem
        });
    } catch (erroBanco) {
        log.erro(
            `Não foi possível atualizar o status da publicação ${id}`,
            formatarErro(erroBanco)
        );
    }
}

/**
 * Guarda o código do post no Instagram, necessário para coletar os
 * comentários depois. É "melhor esforço": se a coluna ainda não existir
 * (migração pendente) ou a gravação falhar, apenas avisa; a publicação já
 * foi concluída e não pode virar erro por causa disso.
 *
 * @param {number} id
 * @param {string|null|undefined} codigo
 */
async function guardarCodigoPost(id, codigo) {
    if (!codigo) {
        log.aviso(
            `Publicação ${id}: o Instagram não informou o código do post; ` +
            "os comentários só poderão ser coletados se o código for definido manualmente."
        );
        return;
    }

    try {
        await publicacoesRepository.atualizar(id, { ig_codigo: codigo });
    } catch (erro) {
        log.aviso(`Publicação ${id}: não foi possível guardar o código do post`, formatarErro(erro));
    }
}

/** Só a automação (sem banco): ver `publicador/automacao.js`. */
function executarAutomacao(dados) {
    return require("../publicador/automacao").publicar(dados);
}

/**
 * Grava no banco o resultado de uma publicação (lado do servidor).
 *
 * @param {number} id - Publicação.
 * @param {{id: number, sessao_expirada_em?: string}|null} conta
 * @param {{sucesso: boolean, incerto?: boolean, mensagem?: string,
 *          codigoPost?: string, sessaoInvalida?: boolean}} resultado
 * @returns {Promise<ResultadoExecucao>}
 */
async function registrarResultado(id, conta, resultado) {
    if (resultado.sucesso) {
        if (conta?.sessao_expirada_em) {
            await contasRepository.limparSessaoExpirada(conta.id).catch(() => {});
        }

        await publicacoesRepository.atualizar(id, { status: STATUS.PUBLICADA, erro: null });
        await guardarCodigoPost(id, resultado.codigoPost);

        log.info(`Publicação ${id} concluída.`);
        return { sucesso: true, id };
    }

    const mensagem = resultado.incerto
        ? `Resultado incerto: ${resultado.mensagem}`
        : resultado.mensagem || "A automação não confirmou a publicação.";

    // O Instagram pediu login: o perfil passa a "Sessão expirada" até ser
    // reconectado (aparece em Clientes, Criar e no aviso de Postagens).
    if (resultado.sessaoInvalida && conta) {
        await contasRepository.marcarSessaoExpirada(conta.id, resultado.mensagem).catch((erro) => {
            log.aviso(`Não foi possível marcar a sessão expirada da conta ${conta.id}`, formatarErro(erro));
        });
    }

    await registrarErro(id, mensagem);

    return { sucesso: false, id, resultadoIncerto: Boolean(resultado.incerto), mensagem };
}

/**
 * Executa a publicação neste mesmo processo (banco + automação): valida
 * imagem e conta, aciona a automação e grava o status final.
 *
 * Nunca lança exceção; falhas retornam `sucesso: false`.
 *
 * @param {{id: number, conta_id: number, imagem: string,
 *          texto: string, mimetype?: string}} publicacao - Registro do banco.
 * @returns {Promise<ResultadoExecucao>}
 */
async function executarPublicacao(publicacao) {
    const id = publicacao.id;

    log.info(`Iniciando publicação ${id}`);

    let conta = null;
    try {
        await publicacoesRepository.atualizar(id, { status: STATUS.PUBLICANDO, erro: null });

        // Do disco; se a imagem foi enviada pelo site na Vercel, baixa do
        // Supabase Storage para este computador.
        const caminhoImagem = await caminhoLocal(publicacao.imagem);

        conta = await contasService.buscarContaAtiva(publicacao.conta_id);
        if (!conta) throw new Error("A conta vinculada não existe ou está inativa.");

        const resultado = await executarAutomacao({
            id, caminhoImagem, texto: publicacao.texto, mimetype: publicacao.mimetype, conta
        });

        return await registrarResultado(id, conta, resultado);
    } catch (erro) {
        const mensagem = formatarErro(erro);

        log.erro(`Erro ao executar publicação ${id}`, mensagem);
        await registrarErro(id, mensagem);

        return { sucesso: false, id, mensagem };
    }
}

module.exports = { executarPublicacao, executarAutomacao, registrarResultado };
