/**
 * IG Manager Publicador (Electron).
 *
 * Fica no ícone ao lado do relógio do Windows e publica no Instagram as
 * postagens do site (Vercel), usando o mesmo código do backend
 * (`backend/src/publicador/ciclo.js`). As chaves do Supabase vêm do
 * `backend/.env` deste computador.
 *
 * - Ao abrir: o que venceu com ele desligado vira "atrasada" e esta janela
 *   pergunta se publica agora ou reagenda.
 * - Ao fechar ou desligar o computador: avisa quantas publicações estão
 *   agendadas e para quais horários (elas não saem com ele desligado).
 * - Inicia junto com o Windows (dá para desligar no menu do ícone).
 *
 * Use UM Publicador por vez (um computador só).
 */
const path = require("path");
const { app, BrowserWindow, Menu, Notification, Tray, dialog, ipcMain, nativeImage, powerMonitor, shell } = require("electron");

process.env.IG_MODO = "publicador";
// Sem terminal à vista: os registros vão para backend/storage/logs/backend.log.
if (!process.env.LOG_EM_ARQUIVO) process.env.LOG_EM_ARQUIVO = "true";

const BACKEND = path.join(__dirname, "..", "backend");
const ICONE = path.join(__dirname, "icone.png");
const ICONE_DESLIGADO = path.join(__dirname, "icone-desligado.png");

if (!app.requestSingleInstanceLock()) {
    app.quit();
}

let ciclo;
let retomada;
let publicacoesService;
let PERFIS;
let siteUrl = "";

let tray = null;
let janela = null;
let saidaConfirmada = false;
let proximas = [];
let atrasadas = [];
let ligado = false;

/** Quem age pelo app (o banco registra como ação da equipe). */
const AUTOR = () => ({ id: null, perfil: PERFIS.ADMIN });

function formatar(iso) {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/* --------------------------------- dados --------------------------------- */

/** Completa com @usuario e cliente, para a janela mostrar. */
async function completar(lista) {
    try {
        return await publicacoesService.completarComConta(lista);
    } catch {
        return lista;
    }
}

async function atualizarProximas() {
    try {
        proximas = await completar(await ciclo.proximasAgendadas());
    } catch {
        // Mantém a última lista conhecida.
    }
    atualizarMenu();
}

/* -------------------------------- janela --------------------------------- */

function criarJanela() {
    janela = new BrowserWindow({
        width: 620,
        height: 560,
        show: false,
        title: "IG Manager Publicador",
        icon: path.join(__dirname, "icone-grande.png"),
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    janela.loadFile(path.join(__dirname, "janela.html"));

    // Fechar a janela só esconde: o Publicador continua no ícone.
    janela.on("close", (evento) => {
        if (!saidaConfirmada) {
            evento.preventDefault();
            janela.hide();
        }
    });

    // Windows vai desligar/reiniciar/sair: avisa das agendadas.
    janela.on("query-session-end", (evento) => {
        if (saidaConfirmada || proximas.length === 0) return;
        evento.preventDefault();
        mostrar({ modo: "saida", desligando: true, itens: proximas, ocupado: ciclo.ocupado() });
    });

    janela.on("session-end", () => {
        saidaConfirmada = true;
        ciclo.parar().finally(() => app.exit(0));
    });
}

function mostrar(dados) {
    const enviar = () => janela.webContents.send("dados", dados);
    if (janela.webContents.isLoading()) janela.webContents.once("did-finish-load", enviar);
    else enviar();
    janela.show();
    janela.focus();
}

async function mostrarAtrasadas() {
    try {
        const repositorio = require(path.join(BACKEND, "src/repositories/publicacoes.repository"));
        atrasadas = await completar(await repositorio.listarPorStatus(repositorio.STATUS.ATRASADA));
    } catch {
        // Usa a última lista conhecida.
    }
    atualizarMenu();
    mostrar({ modo: "atrasadas", itens: atrasadas });
}

/* ------------------------------ ícone e menu ----------------------------- */

function iniciaComWindows() {
    return app.getLoginItemSettings(argumentosInicio()).openAtLogin;
}

/** Sem instalador, o Windows precisa abrir o electron.exe com a pasta do app. */
function argumentosInicio() {
    return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}

function definirInicioComWindows(ativo) {
    app.setLoginItemSettings({ openAtLogin: ativo, ...argumentosInicio() });
    atualizarMenu();
}

function atualizarMenu() {
    if (!tray) return;

    tray.setImage(nativeImage.createFromPath(ligado ? ICONE : ICONE_DESLIGADO));
    tray.setToolTip(
        ligado
            ? `IG Manager Publicador: ligado · ${proximas.length} agendada(s)`
            : "IG Manager Publicador: iniciando..."
    );

    tray.setContextMenu(
        Menu.buildFromTemplate([
            { label: ligado ? "● Publicador ligado" : "○ Iniciando...", enabled: false },
            { type: "separator" },
            ...(siteUrl ? [{ label: "Abrir o site", click: () => shell.openExternal(siteUrl) }] : []),
            {
                label: `Próximas publicações (${proximas.length})`,
                click: async () => {
                    await atualizarProximas();
                    mostrar({ modo: "proximas", itens: proximas });
                }
            },
            { label: `Publicações atrasadas (${atrasadas.length})`, click: mostrarAtrasadas },
            { type: "separator" },
            {
                label: "Iniciar com o Windows",
                type: "checkbox",
                checked: iniciaComWindows(),
                click: (item) => definirInicioComWindows(item.checked)
            },
            {
                label: "Abrir a pasta de registros",
                click: () => shell.openPath(path.join(BACKEND, "storage", "logs"))
            },
            { type: "separator" },
            { label: "Sair", click: pedirSaida }
        ])
    );
}

/* --------------------------------- saída --------------------------------- */

async function pedirSaida() {
    if (!ciclo || !ligado) {
        saidaConfirmada = true;
        return app.exit(0);
    }

    await atualizarProximas();

    if (proximas.length === 0 && !ciclo.ocupado()) return sair();

    mostrar({ modo: "saida", desligando: false, itens: proximas, ocupado: ciclo.ocupado() });
}

async function sair() {
    saidaConfirmada = true;
    await ciclo.parar().catch(() => {});
    app.quit();
}

/* ---------------------------------- IPC ---------------------------------- */

function registrarIpc() {
    const executar = async (fn) => {
        try {
            await fn();
            return { sucesso: true };
        } catch (erro) {
            return { sucesso: false, mensagem: erro.message || String(erro) };
        }
    };

    /** Resolvida: sai da lista (contador do menu do ícone). */
    const tirarDaLista = (id, r) => {
        if (r.sucesso) {
            atrasadas = atrasadas.filter((p) => Number(p.id) !== Number(id));
            atualizarProximas();
        }
        return r;
    };

    ipcMain.handle("atrasada:publicar", async (_e, id) =>
        tirarDaLista(id, await executar(() => retomada.retomar(Number(id), { acao: "publicar" }, AUTOR())))
    );

    ipcMain.handle("atrasada:reagendar", async (_e, id, dataHora) =>
        tirarDaLista(id, await executar(() => retomada.retomar(Number(id), { acao: "agendar", dataHora }, AUTOR())))
    );

    ipcMain.handle("atrasadas:publicar-todas", async () => {
        let ok = 0;
        const falhas = [];
        for (const p of atrasadas) {
            const r = await executar(() => retomada.retomar(Number(p.id), { acao: "publicar" }, AUTOR()));
            if (r.sucesso) ok++;
            else falhas.push(`@${p.username || p.id}: ${r.mensagem}`);
        }
        atrasadas = [];
        atualizarMenu();
        return {
            sucesso: falhas.length === 0,
            mensagem: falhas.length
                ? `${ok} na fila para publicar. Não deu certo: ${falhas.join("; ")}`
                : `${ok} publicação(ões) na fila: saem em instantes, uma por vez.`
        };
    });

    ipcMain.handle("saida:responder", async (_e, escolha) => {
        if (escolha === "sair") return sair();
        janela.hide();
    });

    ipcMain.handle("janela:fechar", () => janela.hide());
}

/* -------------------------------- início --------------------------------- */

function avisar(titulo, corpo) {
    if (Notification.isSupported()) new Notification({ title: titulo, body: corpo, icon: ICONE }).show();
}

async function iniciar() {
    app.setAppUserModelId("IG Manager Publicador");

    tray = new Tray(nativeImage.createFromPath(ICONE_DESLIGADO));
    tray.on("double-click", () => mostrar({ modo: "proximas", itens: proximas }));
    atualizarMenu();

    try {
        ciclo = require(path.join(BACKEND, "src/publicador/ciclo"));
        retomada = require(path.join(BACKEND, "src/services/retomada.service"));
        publicacoesService = require(path.join(BACKEND, "src/services/publicacoes.service"));
        ({ PERFIS } = require(path.join(BACKEND, "src/services/auth.service")));
        siteUrl = process.env.PUBLICADOR_SITE_URL || "";
    } catch (erro) {
        dialog.showErrorBox(
            "IG Manager Publicador",
            "Não foi possível carregar o Publicador. Confira se o backend/.env tem SUPABASE_URL e " +
            "SUPABASE_SERVICE_ROLE_KEY e se o \"npm install\" foi feito na pasta do projeto.\n\n" +
            (erro.message || erro)
        );
        app.exit(1);
        return;
    }

    criarJanela();
    registrarIpc();

    ciclo.eventos.on("atrasadas", async (lista) => {
        atrasadas = await completar(lista);
        atualizarMenu();
        mostrar({ modo: "atrasadas", itens: atrasadas });
    });

    ciclo.eventos.on("publicacao", (r) => {
        avisar(
            r.sucesso ? "Publicado no Instagram" : "A publicação não saiu",
            r.sucesso ? `Publicação ${r.id} concluída.` : `Publicação ${r.id}: ${r.mensagem || "erro"}. Veja em Postagens.`
        );
        atualizarProximas();
    });

    // Computador voltou do sono: o que venceu dormindo fica atrasado.
    powerMonitor.on("resume", () => ciclo.voltouDoSono());

    // Primeira vez: inicia junto com o Windows (pode desligar no menu).
    if (!app.getLoginItemSettings(argumentosInicio()).openAtLogin && !process.env.PUBLICADOR_SEM_AUTOINICIO) {
        definirInicioComWindows(true);
    }

    try {
        await ciclo.iniciar({ versao: app.getVersion() });
        ligado = true;
    } catch (erro) {
        dialog.showErrorBox("IG Manager Publicador", `Não foi possível ligar o Publicador:\n\n${erro.message || erro}`);
    }

    await atualizarProximas();
    setInterval(atualizarProximas, 60 * 1000);

    avisar("IG Manager Publicador ligado", `${proximas.length} publicação(ões) agendada(s). Ele fica no ícone ao lado do relógio.`);
}

app.on("second-instance", () => mostrar({ modo: "proximas", itens: proximas }));
app.on("window-all-closed", (evento) => evento.preventDefault());
app.on("before-quit", (evento) => {
    if (!saidaConfirmada) {
        evento.preventDefault();
        pedirSaida();
    }
});

app.whenReady().then(iniciar);
