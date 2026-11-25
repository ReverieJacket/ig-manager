/**
 * Ações que precisam do navegador (Instagram), vistas pelas rotas.
 *
 * - Modo "completo": executa aqui mesmo, como sempre foi.
 * - Modo "api" (Vercel, sem navegador): grava um pedido para o Publicador
 *   (tabela `tarefas_automacao`) e responde na hora; as telas acompanham o
 *   andamento.
 */
const { config, MODOS } = require("../config/env");
const { ErroHttp } = require("../lib/erros");
const tarefasRepository = require("../repositories/tarefas.repository");
const contasRepository = require("../repositories/contas.repository");
const publicacoesRepository = require("../repositories/publicacoes.repository");
const contasService = require("./contas.service");
const publicadorEstado = require("./publicador-estado.service");
const telaRemota = require("../lib/tela-remota");

const { TIPOS, STATUS_TAREFA } = tarefasRepository;
const { STATUS } = publicacoesRepository;

const viaPublicador = () => config.modo === MODOS.API;

function instagramAuth() {
    return require("./instagram-auth.service");
}

/** Pedido para o Publicador (avisa se a migração 011 não foi executada). */
async function pedir(dados) {
    try {
        return await tarefasRepository.criar(dados);
    } catch (erro) {
        if (/tarefas_automacao|relation|schema cache/i.test(erro?.message || "")) {
            throw new ErroHttp(500, "Função indisponível: execute a migração 011 no Supabase.");
        }
        throw erro;
    }
}

/** Abre o Chromium para o login do perfil (aqui ou no Publicador). */
async function conectar(contaId) {
    if (!viaPublicador()) return instagramAuth().iniciar(contaId);

    const conta = await contasService.buscarContaAtiva(contaId);
    if (!conta) throw new ErroHttp(404, "Conta não encontrada ou inativa.");

    await publicadorEstado.exigirOnline("conectar um perfil");

    const anterior = await tarefasRepository.ultimaDoPerfil(TIPOS.CONECTAR, conta.id).catch(() => null);
    if (anterior && [STATUS_TAREFA.PENDENTE, STATUS_TAREFA.EXECUTANDO].includes(anterior.status)) {
        return estadoDaTarefa(conta, anterior);
    }

    const tarefa = await pedir({ tipo: TIPOS.CONECTAR, contaId: conta.id });
    return estadoDaTarefa(conta, tarefa);
}

/** Traduz o pedido de conexão para o formato que as telas já usam. */
function estadoDaTarefa(conta, tarefa) {
    const base = { contaId: Number(conta.id), username: conta.username };
    // Tela remota: o Instagram aparece no site para quem clicou em "Conectar".
    const remoto = telaRemota.dadosDoCanal(tarefa.id);
    const emAndamento = remoto ? { remoto } : {};

    if (tarefa.status === STATUS_TAREFA.PENDENTE) {
        return {
            ...base,
            ...emAndamento,
            status: "iniciando",
            mensagem: remoto
                ? "Abrindo o Instagram no Publicador. Ele vai aparecer aqui em instantes."
                : "Pedido enviado ao Publicador; o Chromium vai abrir no computador dele."
        };
    }
    if (tarefa.status === STATUS_TAREFA.EXECUTANDO) {
        return {
            ...base,
            ...emAndamento,
            status: "aguardando_login",
            mensagem: remoto
                ? `Entre na conta @${conta.username} na tela do Instagram abaixo.`
                : tarefa.mensagem || `Entre na conta @${conta.username} no Chromium aberto no computador do Publicador.`
        };
    }
    if (tarefa.status === STATUS_TAREFA.CONCLUIDA) {
        return { ...base, status: "conectado", mensagem: tarefa.mensagem || "Sessão salva no Publicador." };
    }
    return { ...base, status: "cancelado", mensagem: tarefa.mensagem || "A conexão não foi concluída." };
}

/** Andamento da conexão (as telas consultam a cada poucos segundos). */
async function consultarConexao(contaId) {
    if (!viaPublicador()) return instagramAuth().consultar(contaId);

    const conta = await contasRepository.buscarPorId(Number(contaId));
    if (!conta) throw new ErroHttp(404, "Conta não encontrada.");

    const tarefa = await tarefasRepository.ultimaDoPerfil(TIPOS.CONECTAR, conta.id).catch(() => null);
    if (tarefa && [STATUS_TAREFA.PENDENTE, STATUS_TAREFA.EXECUTANDO].includes(tarefa.status)) {
        return estadoDaTarefa(conta, tarefa);
    }

    if (conta.sessao_salva_em) {
        return { contaId: conta.id, username: conta.username, status: "conectado", mensagem: "Sessão salva no Publicador." };
    }
    if (tarefa) return estadoDaTarefa(conta, tarefa);

    return { contaId: conta.id, status: "desconectado", mensagem: "Nenhum processo de conexão ativo." };
}

/**
 * Desconecta o perfil. Via Publicador, o site já mostra "desconectado" na
 * hora; o arquivo de sessão é apagado quando o Publicador pegar o pedido.
 */
async function desconectar(contaId) {
    if (!viaPublicador()) return instagramAuth().desconectar(contaId);

    const id = Number(contaId);
    await contasRepository.definirSessaoSalva(id, null).catch(() => {});
    await contasRepository.limparSessaoExpirada(id).catch(() => {});
    await pedir({ tipo: TIPOS.DESCONECTAR, contaId: id }).catch(() => {});

    return { contaId: id, status: "desconectado", mensagem: "Sessão removida." };
}

/**
 * Coleta os comentários de uma publicação. Via Publicador devolve
 * `{ emAndamento: true, tarefaId }`; as telas acompanham por /tarefas/:id.
 */
async function coletarComentarios(publicacaoId) {
    if (!viaPublicador()) {
        return require("./comentarios.service").coletarComentarios(publicacaoId);
    }

    const publicacao = await publicacoesRepository.buscarPorId(publicacaoId);
    if (!publicacao) throw new ErroHttp(404, "Publicação não encontrada.");
    if (publicacao.status !== STATUS.PUBLICADA) {
        throw new ErroHttp(409, "Só é possível coletar comentários de publicações já publicadas.");
    }
    if (!publicacao.ig_codigo) {
        throw new ErroHttp(409, "Esta publicação não tem o código do post no Instagram.");
    }

    await publicadorEstado.exigirOnline("coletar comentários");

    const tarefa = await pedir({ tipo: TIPOS.COLETAR_COMENTARIOS, publicacaoId: publicacao.id });
    return { emAndamento: true, tarefaId: tarefa.id };
}

/** Andamento de um pedido (coleta de comentários). */
async function consultarTarefa(id) {
    const tarefa = await tarefasRepository.buscarPorId(Number(id));
    if (!tarefa) throw new ErroHttp(404, "Pedido não encontrado.");

    return {
        id: tarefa.id,
        tipo: tarefa.tipo,
        status: tarefa.status,
        mensagem: tarefa.mensagem,
        resultado: tarefa.resultado,
        concluida: [STATUS_TAREFA.CONCLUIDA, STATUS_TAREFA.ERRO].includes(tarefa.status)
    };
}

module.exports = { conectar, consultarConexao, desconectar, coletarComentarios, consultarTarefa, contaConectada: (id) => instagramAuth().contaConectada(id) };
