/**
 * Serviço de publicações: regras de negócio da API.
 *
 * Orquestra repositórios, agendador e publicador. As rotas só chamam
 * estas funções; não falam direto com o banco.
 */
const path = require("path");

const { ErroHttp } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const contasRepository = require("../repositories/contas.repository");
const contasService = require("./contas.service");
const agendador = require("./agendador.service");
const { executarPublicacao } = require("./publicador.service");

const { STATUS } = publicacoesRepository;
const log = criarLogger("Publicacoes");

/**
 * Lista as publicações já com nome/username da conta e URL pública da imagem.
 *
 * @returns {Promise<object[]>}
 */
async function listarPublicacoes() {
    const publicacoes = await publicacoesRepository.listar();

    if (publicacoes.length === 0) return [];

    const idsContas = [...new Set(publicacoes.map((p) => p.conta_id))];
    const contas = await contasRepository.buscarPorIds(idsContas);
    const contasPorId = new Map(contas.map((conta) => [conta.id, conta]));

    return publicacoes.map((publicacao) => {
        const conta = contasPorId.get(publicacao.conta_id);

        return {
            ...publicacao,
            conta: conta?.nome || "",
            username: conta?.username || "",
            imagem: publicacao.imagem
                ? `/uploads/${encodeURIComponent(path.basename(publicacao.imagem))}`
                : null
        };
    });
}

/**
 * Busca uma publicação pelo id.
 *
 * @param {number} id
 * @returns {Promise<object>}
 * @throws {ErroHttp} 404 se não existir.
 */
async function buscarPublicacao(id) {
    const publicacao = await publicacoesRepository.buscarPorId(id);

    if (!publicacao) {
        throw new ErroHttp(404, "Publicação não encontrada.");
    }

    return publicacao;
}

/**
 * Cria uma publicação. Se a data for futura, apenas agenda; caso
 * contrário, publica imediatamente e aguarda o resultado.
 *
 * @param {{arquivo: Express.Multer.File, texto: string,
 *          contaId: number, dataHora: Date}} entrada - Dados já validados.
 * @returns {Promise<{agendada: boolean, publicacao: object,
 *                    resultado?: object}>}
 * @throws {ErroHttp} 400 se a conta não existir ou estiver inativa.
 */
async function criarPublicacao({ arquivo, texto, contaId, dataHora }) {
    const conta = await contasService.buscarContaAtiva(contaId);

    if (!conta) {
        throw new ErroHttp(
            400,
            "A conta selecionada não existe ou está inativa."
        );
    }

    const agendada = dataHora.getTime() > Date.now();

    log.info("Registrando nova publicação", {
        contaId,
        username: conta.username,
        dataHora: dataHora.toISOString(),
        agendada
    });

    const publicacao = await publicacoesRepository.criar({
        conta_id: contaId,
        imagem: arquivo.filename,
        texto,
        data_hora: dataHora.toISOString(),
        status: agendada ? STATUS.AGENDADA : STATUS.PUBLICANDO,
        erro: null
    });

    log.info(`Publicação registrada: ${publicacao.id}`);

    if (agendada) {
        agendador.agendar(publicacao);
        return { agendada: true, publicacao };
    }

    const resultado = await executarPublicacao(publicacao);

    return { agendada: false, publicacao, resultado };
}

module.exports = { listarPublicacoes, buscarPublicacao, criarPublicacao };
