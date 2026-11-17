/**
 * Publicador sem janela (terminal): `npm run publicador`.
 *
 * Faz o mesmo que o app "IG Manager Publicador" (Electron), só que no
 * terminal: útil para testar ou para deixar rodando num computador sem o
 * app instalado. Use UM Publicador por vez.
 */
process.env.IG_MODO = "publicador";

const ciclo = require("../src/publicador/ciclo");
const { criarLogger } = require("../src/lib/logger");
const { formatarErro } = require("../src/lib/erros");

const log = criarLogger("Publicador");

function formatarHorario(iso) {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

ciclo.eventos.on("atrasadas", (lista) => {
    log.aviso(
        `${lista.length} publicação(ões) atrasada(s): o horário passou com o Publicador desligado. ` +
        "No site, em Postagens, escolha \"Publicar agora\" ou \"Reagendar\".",
        { horarios: lista.map((p) => formatarHorario(p.data_hora)) }
    );
});

async function sair() {
    try {
        const proximas = await ciclo.proximasAgendadas();
        if (proximas.length > 0) {
            log.aviso(
                `Atenção: ${proximas.length} publicação(ões) agendada(s) NÃO serão publicadas enquanto o Publicador estiver desligado.`,
                { horarios: proximas.slice(0, 10).map((p) => formatarHorario(p.data_hora)) }
            );
        }
    } catch {
        // Sem banco: só desliga.
    }
    await ciclo.parar();
    process.exit(0);
}

process.on("SIGINT", sair);
process.on("SIGTERM", sair);

ciclo.iniciar({ versao: "terminal" }).catch((erro) => {
    log.erro("Não foi possível iniciar o Publicador", formatarErro(erro));
    process.exit(1);
});
