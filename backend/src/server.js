/**
 * Ponto de entrada do backend: `npm run dev -w backend` (ou `start`).
 */
const fs = require("fs");

const { config } = require("./config/env");
const { criarLogger } = require("./lib/logger");
const { criarApp } = require("./app");
const { formatarErro } = require("./lib/erros");
const agendador = require("./services/agendador.service");

const log = criarLogger("Servidor");

fs.mkdirSync(config.diretorios.logs, { recursive: true });

// Rede de segurança: sem estes ouvintes, uma falha fora das rotas (por
// exemplo, dentro de um timer do agendador) passaria sem registro.
process.on("unhandledRejection", (motivo) => {
    log.erro("Promessa rejeitada sem tratamento", motivo);
});

process.on("uncaughtException", (erro) => {
    log.erro("Exceção não capturada; encerrando o processo", erro);
    // O estado do processo é incerto após uma exceção: melhor reiniciar.
    setTimeout(() => process.exit(1), 100);
});

async function iniciar() {
    // Antes do `listen`: assim nenhuma publicação nova, criada por uma
    // requisição, é confundida com uma que ficou presa em `publicando`.
    try {
        await agendador.restaurarPendentes();
    } catch (erro) {
        // Sem banco o servidor ainda sobe; os agendamentos antigos ficam
        // pendentes até o próximo reinício.
        log.erro(
            "Não foi possível restaurar os agendamentos do banco",
            formatarErro(erro)
        );
    }

    criarApp().listen(config.porta, () => {
        log.info(`Servidor rodando em http://localhost:${config.porta}`, {
            ambiente: config.emProducao ? "producao" : "desenvolvimento",
            nivelLog: config.log.nivel,
            arquivoLog: config.log.emArquivo ? config.log.arquivo : "desativado"
        });
    });
}

iniciar();
