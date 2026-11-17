/**
 * Ponto de entrada do backend: `npm run dev -w backend` (ou `start`).
 */
const fs = require("fs");

const { config, MODOS } = require("./config/env");
const { criarLogger } = require("./lib/logger");
const { criarApp } = require("./app");
const { formatarErro } = require("./lib/erros");
const ciclo = require("./publicador/ciclo");

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
    // Modo "completo": o Publicador roda aqui mesmo. Antes do `listen`,
    // para organizar o que ficou para trás (interrompidas, atrasadas) antes
    // de chegar qualquer pedido novo.
    if (config.modo === MODOS.COMPLETO) {
        try {
            await ciclo.iniciar({ versao: "backend" });
        } catch (erro) {
            // Sem banco o servidor ainda sobe; o Publicador tenta de novo a cada rodada.
            log.erro("Não foi possível iniciar o Publicador", formatarErro(erro));
        }
    }

    criarApp().listen(config.porta, () => {
        log.info(`Servidor rodando em http://localhost:${config.porta}`, {
            ambiente: config.emProducao ? "producao" : "desenvolvimento",
            modo: config.modo,
            nivelLog: config.log.nivel,
            arquivoLog: config.log.emArquivo ? config.log.arquivo : "desativado"
        });
    });
}

// Ctrl+C / reinício do `node --watch`: o site passa a mostrar "desligado".
for (const sinal of ["SIGINT", "SIGTERM"]) {
    process.on(sinal, () => {
        ciclo.parar().finally(() => process.exit(0));
    });
}

iniciar();
