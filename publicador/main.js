/**
 * IG Manager Publicador (Electron).
 *
 * Fica no ícone ao lado do relógio do Windows e publica no Instagram as
 * postagens do site. Usa o mesmo código do backend
 * (`backend/src/publicador/ciclo.js`), mas conversa com o site só pelo
 * login de um administrador: o app NÃO tem a chave do banco.
 *
 * - Primeira vez: pede o login (e-mail e senha de administrador). O app
 *   guarda só um token, criptografado pelo Windows (safeStorage).
 * - Ao abrir: o que venceu com ele desligado vira "atrasada" e a janela
 *   pergunta se publica agora ou reagenda.
 * - Ao fechar ou desligar o computador: avisa quantas publicações estão
 *   agendadas e para quais horários (elas não saem com ele desligado).
 * - Inicia junto com o Windows por padrão (dá para desligar no menu).
 *
 * Use UM Publicador por vez (um computador só).
 */
const fs = require("fs");
const path = require("path");
const {
    app, BrowserWindow, Menu, Notification, Tray, dialog, ipcMain, nativeImage, powerMonitor, safeStorage, shell
} = require("electron");

const pacote = require("./package.json");

/* ------------------------- ambiente (antes do backend) ------------------- */

process.env.IG_MODO = "publicador";
// Sem terminal à vista: os registros vão para o arquivo de log.
if (!process.env.LOG_EM_ARQUIVO) process.env.LOG_EM_ARQUIVO = "true";

if (app.isPackaged) {
    // Instalado: dados em AppData, Edge do Windows como navegador, logs JSON.
    process.env.NODE_ENV = "production";
    if (!process.env.IG_PASTA_DADOS) process.env.IG_PASTA_DADOS = path.join(app.getPath("userData"), "dados");
    if (!process.env.IG_NAVEGADOR_CANAL) process.env.IG_NAVEGADOR_CANAL = "msedge";
}

/** Código do backend: copiado para dentro do app ao gerar o instalador. */
const BACKEND = fs.existsSync(path.join(__dirname, "backend", "src"))
    ? path.join(__dirname, "backend")
    : path.join(__dirname, "..", "backend");

const ICONE = path.join(__dirname, "icone.png");
const ICONE_DESLIGADO = path.join(__dirname, "icone-desligado.png");
const SITE_PADRAO = pacote.igManager?.siteUrl || "";
const ARQUIVO_CONTA = () => path.join(app.getPath("userData"), "conta.dat");
const ARQUIVO_PREFERENCIAS = () => path.join(app.getPath("userData"), "preferencias.json");

if (!app.requestSingleInstanceLock()) {
    app.quit();
}

let ciclo;
let portaRemota;
let config;

let tray = null;
let janela = null;
let saidaConfirmada = false;
let proximas = [];
let atrasadas = [];
let ligado = false;
let conta = null; // { site, token, email, nome }
let tentativa = null;

/* ------------------------------- login salvo ----------------------------- */

function lerConta() {
    try {
        const bruto = fs.readFileSync(ARQUIVO_CONTA());
        const texto = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(bruto) : null;
        return texto ? JSON.parse(texto) : null;
    } catch {
        return null;
    }
}

function gravarConta(dados) {
    if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("O Windows não liberou a criptografia para guardar o login.");
    }
    fs.mkdirSync(path.dirname(ARQUIVO_CONTA()), { recursive: true });
    fs.writeFileSync(ARQUIVO_CONTA(), safeStorage.encryptString(JSON.stringify(dados)));
}

function apagarConta() {
    try {
        fs.unlinkSync(ARQUIVO_CONTA());
    } catch {
        // Já não existia.
    }
}

function lerPreferencias() {
    try {
        return JSON.parse(fs.readFileSync(ARQUIVO_PREFERENCIAS(), "utf8"));
    } catch {
        return {};
    }
}

function gravarPreferencias(dados) {
    fs.mkdirSync(path.dirname(ARQUIVO_PREFERENCIAS()), { recursive: true });
    fs.writeFileSync(ARQUIVO_PREFERENCIAS(), JSON.stringify({ ...lerPreferencias(), ...dados }));
}

/* ------------------------------ Publicador ------------------------------- */

async function atualizarProximas() {
    if (!ligado) return atualizarMenu();
    try {
        proximas = await ciclo.proximasAgendadas();
    } catch {
        // Mantém a última lista conhecida.
    }
    atualizarMenu();
}

/** Liga o Publicador com o login salvo. Sem internet, tenta de novo em 30 s. */
async function ligar() {
    clearTimeout(tentativa);
    if (ligado || !conta) return;

    const porta = portaRemota.criarPortaRemota({
        site: conta.site,
        token: conta.token,
        aoPerderSessao: () => setImmediate(perderSessao)
    });

    try {
        await ciclo.iniciar({ versao: app.getVersion(), porta });
        ligado = true;
    } catch (erro) {
        if (erro?.sessao) return perderSessao();
        tray?.setToolTip(`IG Manager Publicador: sem conexão com o site (${erro.message})`);
        tentativa = setTimeout(ligar, 30 * 1000);
        return;
    }

    await atualizarProximas();
    avisar("IG Manager Publicador ligado", `${proximas.length} publicação(ões) agendada(s). Ele fica no ícone ao lado do relógio.`);
}

/** O login deixou de valer (senha trocada, usuário desativado, 180 dias). */
async function perderSessao() {
    if (!conta) return;
    await ciclo.parar({ avisarServidor: false }).catch(() => {});
    ligado = false;
    apagarConta();
    const email = conta.email;
    const site = conta.site;
    conta = null;
    atualizarMenu();
    mostrar({
        modo: "login",
        site,
        email,
        aviso: "Sua sessão expirou ou foi encerrada (por exemplo, a senha mudou). Entre de novo para continuar publicando."
    });
}

/* -------------------------------- janela --------------------------------- */

function criarJanela() {
    janela = new BrowserWindow({
        width: 620,
        height: 600,
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
        if (saidaConfirmada || !ligado || proximas.length === 0) return;
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

function mostrarLogin(aviso) {
    mostrar({ modo: "login", site: conta?.site || SITE_PADRAO, email: conta?.email || "", aviso });
}

async function mostrarAtrasadas() {
    try {
        atrasadas = await ciclo.listarAtrasadas();
    } catch {
        // Usa a última lista conhecida.
    }
    atualizarMenu();
    mostrar({ modo: "atrasadas", itens: atrasadas });
}

/* ------------------------------ ícone e menu ----------------------------- */

/** Sem instalador (npm start), o Windows precisa abrir o electron.exe com a pasta do app. */
function argumentosInicio() {
    return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}

function iniciaComWindows() {
    return app.getLoginItemSettings(argumentosInicio()).openAtLogin;
}

function definirInicioComWindows(ativo) {
    app.setLoginItemSettings({ openAtLogin: ativo, ...argumentosInicio() });
    gravarPreferencias({ autoinicioDefinido: true });
    atualizarMenu();
}

function atualizarMenu() {
    if (!tray) return;

    tray.setImage(nativeImage.createFromPath(ligado ? ICONE : ICONE_DESLIGADO));
    tray.setToolTip(
        ligado
            ? `IG Manager Publicador: ligado · ${proximas.length} agendada(s)`
            : conta ? "IG Manager Publicador: conectando..." : "IG Manager Publicador: entre com seu login"
    );

    const site = conta?.site || SITE_PADRAO;

    tray.setContextMenu(
        Menu.buildFromTemplate([
            {
                label: ligado ? "● Publicador ligado" : conta ? "○ Conectando ao site..." : "○ Desconectado",
                enabled: false
            },
            ...(conta ? [{ label: `Conta: ${conta.email}`, enabled: false }] : []),
            { type: "separator" },
            ...(conta
                ? []
                : [{ label: "Entrar…", click: () => mostrarLogin() }]),
            ...(site ? [{ label: "Abrir o site", click: () => shell.openExternal(site) }] : []),
            {
                label: `Próximas publicações (${proximas.length})`,
                enabled: ligado,
                click: async () => {
                    await atualizarProximas();
                    mostrar({ modo: "proximas", itens: proximas });
                }
            },
            { label: `Publicações atrasadas (${atrasadas.length})`, enabled: ligado, click: mostrarAtrasadas },
            { type: "separator" },
            {
                label: "Iniciar com o Windows",
                type: "checkbox",
                checked: iniciaComWindows(),
                click: (item) => definirInicioComWindows(item.checked)
            },
            {
                label: "Abrir a pasta de registros",
                click: () => shell.openPath(config.diretorios.logs)
            },
            ...(conta ? [{ label: "Sair da conta", click: sairDaConta }] : []),
            { type: "separator" },
            { label: "Fechar o Publicador", click: pedirSaida }
        ])
    );
}

/* --------------------------------- saída --------------------------------- */

async function sairDaConta() {
    const { response } = await dialog.showMessageBox({
        type: "question",
        buttons: ["Sair da conta", "Cancelar"],
        defaultId: 1,
        cancelId: 1,
        title: "IG Manager Publicador",
        message: "Sair da conta neste computador?",
        detail: "O Publicador para de publicar até alguém entrar de novo com um login de administrador."
    });
    if (response !== 0) return;

    await ciclo.parar().catch(() => {});
    ligado = false;
    apagarConta();
    conta = null;
    proximas = [];
    atrasadas = [];
    atualizarMenu();
    mostrarLogin();
}

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
    if (ligado) await ciclo.parar().catch(() => {});
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

    ipcMain.handle("login:entrar", async (_e, dados) => {
        const site = String(dados?.site || "").trim().replace(/\/+$/, "");
        const email = String(dados?.email || "").trim();
        const senha = String(dados?.senha || "");

        if (!/^https?:\/\//i.test(site)) return { sucesso: false, mensagem: "Informe o endereço do site (https://...)." };
        if (!email || !senha) return { sucesso: false, mensagem: "Informe o e-mail e a senha." };

        try {
            const { token, usuario } = await portaRemota.entrar(site, email, senha);
            conta = { site, token, email: usuario?.email || email, nome: usuario?.nome || "" };
            gravarConta(conta);
        } catch (erro) {
            conta = null;
            return { sucesso: false, mensagem: erro.message || String(erro) };
        }

        atualizarMenu();
        ligar();
        return { sucesso: true, mensagem: `Conectado como ${conta.email}. O Publicador está ligando…` };
    });

    /** Resolvida: sai da lista (contador do menu do ícone). */
    const tirarDaLista = (id, r) => {
        if (r.sucesso) {
            atrasadas = atrasadas.filter((p) => Number(p.id) !== Number(id));
            atualizarProximas();
        }
        return r;
    };

    ipcMain.handle("atrasada:publicar", async (_e, id) =>
        tirarDaLista(id, await executar(() => ciclo.retomar(Number(id), { acao: "publicar" })))
    );

    ipcMain.handle("atrasada:reagendar", async (_e, id, dataHora) =>
        tirarDaLista(id, await executar(() => ciclo.retomar(Number(id), { acao: "agendar", dataHora })))
    );

    ipcMain.handle("atrasadas:publicar-todas", async () => {
        let ok = 0;
        const falhas = [];
        for (const p of atrasadas) {
            const r = await executar(() => ciclo.retomar(Number(p.id), { acao: "publicar" }));
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
    tray.on("double-click", () => (ligado ? mostrar({ modo: "proximas", itens: proximas }) : mostrarLogin()));

    try {
        ({ config } = require(path.join(BACKEND, "src/config/env")));
        ciclo = require(path.join(BACKEND, "src/publicador/ciclo"));
        portaRemota = require(path.join(BACKEND, "src/publicador/porta-remota"));
    } catch (erro) {
        dialog.showErrorBox(
            "IG Manager Publicador",
            "Não foi possível carregar o Publicador. Reinstale o aplicativo.\n\n" + (erro.message || erro)
        );
        app.exit(1);
        return;
    }

    atualizarMenu();
    criarJanela();
    registrarIpc();

    ciclo.eventos.on("atrasadas", (lista) => {
        atrasadas = lista;
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

    ciclo.eventos.on("sessaoPerdida", () => perderSessao());

    // Computador voltou do sono: o que venceu dormindo fica atrasado.
    powerMonitor.on("resume", () => ciclo.voltouDoSono());

    // Padrão: inicia junto com o Windows. Só na primeira vez; depois vale
    // a escolha feita no menu do ícone.
    if (!lerPreferencias().autoinicioDefinido && !process.env.PUBLICADOR_SEM_AUTOINICIO) {
        definirInicioComWindows(true);
    }

    setInterval(atualizarProximas, 60 * 1000);

    conta = lerConta();
    if (!conta) {
        mostrarLogin();
        return;
    }

    await ligar();
}

app.on("second-instance", () => (ligado ? mostrar({ modo: "proximas", itens: proximas }) : mostrarLogin()));
app.on("window-all-closed", (evento) => evento.preventDefault());
app.on("before-quit", (evento) => {
    if (!saidaConfirmada) {
        evento.preventDefault();
        pedirSaida();
    }
});

app.whenReady().then(iniciar);
