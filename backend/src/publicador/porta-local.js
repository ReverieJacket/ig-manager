/**
 * Publicador com acesso direto ao banco (backend completo e
 * `npm run publicador`): usa as mesmas regras do site, sem HTTP.
 */
const servidor = require("../services/publicador-servidor.service");

function criarPortaLocal() {
    return {
        tipo: "local",
        iniciar: (dados) => servidor.iniciar(dados),
        sinalizar: () => servidor.sinalizar(),
        desligar: () => servidor.desligar(),
        vencidas: () => servidor.vencidas(),
        tratar: (id, acordadoDesde) => servidor.tratar(id, acordadoDesde),
        registrarResultado: (id, resultado) => servidor.registrarResultado(id, resultado),

        /** A imagem no disco (ou baixada do Storage). */
        async baixarImagem(publicacao) {
            const { caminhoLocal } = require("../lib/imagens");
            return caminhoLocal(publicacao.imagem);
        },

        atrasadas: () => servidor.atrasadas(),
        proximas: () => servidor.proximas(),

        /** Publicar agora / reagendar uma atrasada, como a equipe. */
        async retomar(id, dados) {
            const retomada = require("../services/retomada.service");
            const { PERFIS } = require("../services/auth.service");
            return retomada.retomar(Number(id), dados, { id: null, perfil: PERFIS.ADMIN });
        },

        tarefasPendentes: () => servidor.tarefasPendentes(),
        pegarTarefa: (id) => servidor.pegarTarefa(id),
        informarTarefa: (id, mensagem) => servidor.informarTarefa(id, mensagem),
        concluirTarefa: (id, fim) => servidor.concluirTarefa(id, fim),

        contasAtivas: () => servidor.contasAtivas(),
        contaParaConectar: (id) => servidor.contaParaConectar(id),
        definirSessao: (id, quando) => servidor.definirSessao(id, quando),
        salvarComentarios: (id, coleta) => servidor.salvarComentarios(id, coleta)
    };
}

module.exports = { criarPortaLocal };
