/**
 * Serviço que executa uma publicação já registrada no banco.
 *
 * Coordena três coisas: o status no banco, a conta vinculada e a
 * automação do Instagram. É chamado tanto pelo envio imediato quanto
 * pelo agendador.
 */
const fs = require("fs");
const path = require("path");

const { config } = require("../config/env");
const { criarLogger } = require("../lib/logger");
const { formatarErro } = require("../lib/erros");
const { publicarNoInstagram } = require("../automacao/instagram/publicar");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const contasService = require("./contas.service");

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
 * Executa a publicação: valida imagem e conta, aciona a automação e
 * grava o status final (`publicada` ou `erro`).
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

    try {
        await publicacoesRepository.atualizar(id, {
            status: STATUS.PUBLICANDO,
            erro: null
        });

        // `path.basename` impede que um valor adulterado no banco aponte
        // para fora da pasta de uploads.
        const caminhoImagem = path.resolve(
            config.diretorios.uploads,
            path.basename(publicacao.imagem)
        );

        if (!fs.existsSync(caminhoImagem)) {
            throw new Error(
                `Imagem não encontrada no servidor: ${caminhoImagem}`
            );
        }

        const conta = await contasService.buscarContaAtiva(publicacao.conta_id);

        if (!conta) {
            throw new Error("A conta vinculada não existe ou está inativa.");
        }

        log.info(`Conta selecionada para publicação ${id}`, {
            id: conta.id,
            username: conta.username
        });

        // Cada conta utiliza um arquivo de sessão isolado, identificado pelo ID.
        const resultado = await publicarNoInstagram(
            caminhoImagem,
            publicacao.texto,
            publicacao.mimetype || undefined,
            Number(conta.id)
        );

        log.info(`Resultado da automação da publicação ${id}`, resultado);

        if (resultado.sucesso) {
            await publicacoesRepository.atualizar(id, {
                status: STATUS.PUBLICADA,
                erro: null
            });

            log.info(`Publicação ${id} concluída.`);
            return { sucesso: true, id };
        }

        const mensagem = resultado.incerto
            ? `Resultado incerto: ${resultado.mensagem}`
            : resultado.mensagem;

        await publicacoesRepository.atualizar(id, {
            status: STATUS.ERRO,
            erro: mensagem
        });

        return {
            sucesso: false,
            id,
            resultadoIncerto: Boolean(resultado.incerto),
            mensagem
        };
    } catch (erro) {
        const mensagem = formatarErro(erro);

        log.erro(`Erro ao executar publicação ${id}`, mensagem);
        await registrarErro(id, mensagem);

        return { sucesso: false, id, mensagem };
    }
}

module.exports = { executarPublicacao };
