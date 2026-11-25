/**
 * Tela remota (lado do Publicador): transmite a página do Instagram, aberta
 * num navegador escondido, para quem clicou em "Conectar" no site, e repete
 * aqui os toques, o texto e as teclas que essa pessoa enviar.
 *
 * Transporte: Supabase Realtime (lib/canal-realtime), num canal secreto por
 * pedido. As imagens são JPEG do próprio Chromium (CDP Page.startScreencast),
 * no máximo ~5 por segundo.
 *
 * Segurança: o navegador só fica em páginas do Instagram (e do Facebook, que
 * o Instagram usa em algumas verificações); outras janelas são fechadas. A
 * senha digitada não é guardada: vai direto para o campo do Instagram.
 */
const { CanalRealtime } = require("../../lib/canal-realtime");

/** Tamanho da "tela" do celular simulado no navegador escondido. */
const VIEWPORT = Object.freeze({ width: 412, height: 800 });

const INTERVALO_MIN_MS = 200;
/** Acima disso (base64) a imagem é reenviada com qualidade menor. */
const TAMANHO_MAX = 180 * 1000;
const TECLAS_PERMITIDAS = new Set([
    "Enter", "Backspace", "Tab", "Escape", "Delete",
    "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"
]);
const INICIO = "https://www.instagram.com/accounts/login/";

function hostPermitido(endereco) {
    if (!endereco || endereco === "about:blank") return true;
    try {
        const { hostname, protocol } = new URL(endereco);
        if (protocol !== "https:") return false;
        return /(^|\.)(instagram\.com|facebook\.com)$/i.test(hostname);
    } catch {
        return false;
    }
}

/**
 * Começa a transmitir a página.
 *
 * @param {import("playwright").Page} page
 * @param {{url: string, chave: string, canal: string}} remoto
 * @param {{aoCancelar?: () => void, log?: object}} [opcoes]
 * @returns {Promise<{informar: (status: string, mensagem: string) => void,
 *                    parar: () => Promise<void>}>}
 */
async function iniciar(page, remoto, { aoCancelar, log } = {}) {
    let qualidade = 55;
    let ultimo = null;
    let enviadoEm = 0;
    let agendado = null;
    let numero = 0;
    let estado = { status: "iniciando", mensagem: "Abrindo o Instagram..." };
    let parado = false;
    let fila = Promise.resolve();

    const cdp = await page.context().newCDPSession(page);

    function enviarQuadro() {
        agendado = null;
        if (!ultimo || parado) return;
        enviadoEm = Date.now();
        canal.enviar("quadro", { n: ++numero, img: ultimo.data, w: ultimo.w, h: ultimo.h });
    }

    function agendarQuadro() {
        if (agendado) return;
        const espera = Math.max(0, INTERVALO_MIN_MS - (Date.now() - enviadoEm));
        agendado = setTimeout(enviarQuadro, espera);
    }

    async function comecarTransmissao() {
        await cdp.send("Page.startScreencast", {
            format: "jpeg",
            quality: qualidade,
            maxWidth: VIEWPORT.width,
            maxHeight: VIEWPORT.height,
            everyNthFrame: 1
        });
    }

    cdp.on("Page.screencastFrame", ({ data, sessionId, metadata }) => {
        cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
        if (parado) return;
        if (data.length > TAMANHO_MAX && qualidade > 25) {
            qualidade -= 10;
            cdp.send("Page.stopScreencast").then(comecarTransmissao).catch(() => {});
            return;
        }
        ultimo = {
            data,
            w: Math.round(metadata?.deviceWidth || VIEWPORT.width),
            h: Math.round(metadata?.deviceHeight || VIEWPORT.height)
        };
        agendarQuadro();
    });

    /** Executa as ações em ordem (um toque depois do outro). */
    function emOrdem(acao) {
        fila = fila.then(acao).catch((erro) => log?.aviso?.("Tela remota: ação não executada", erro?.message));
    }

    async function tratar(evento, dados) {
        if (parado) return;
        const tamanho = page.viewportSize() || VIEWPORT;

        if (evento === "ola") {
            canal.enviar("estado", estado);
            if (ultimo) enviarQuadro();
            return;
        }
        if (evento === "clique") {
            const x = Number(dados.x), y = Number(dados.y);
            if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return;
            emOrdem(() => page.mouse.click(x * tamanho.width, y * tamanho.height));
            return;
        }
        if (evento === "rolar") {
            const dy = Math.max(-2000, Math.min(2000, Number(dados.dy) || 0));
            emOrdem(() => page.mouse.wheel(0, dy));
            return;
        }
        if (evento === "texto") {
            const texto = String(dados.texto || "").slice(0, 200);
            if (texto) emOrdem(() => page.keyboard.type(texto, { delay: 25 }));
            return;
        }
        if (evento === "tecla") {
            if (TECLAS_PERMITIDAS.has(dados.tecla)) emOrdem(() => page.keyboard.press(dados.tecla));
            return;
        }
        if (evento === "recarregar") {
            emOrdem(() => page.goto(INICIO, { waitUntil: "domcontentloaded", timeout: 60000 }));
            return;
        }
        if (evento === "cancelar") {
            aoCancelar?.();
        }
    }

    const canal = new CanalRealtime({
        ...remoto,
        aoReceber: (evento, dados) => {
            tratar(evento, dados).catch(() => {});
        }
    });
    await canal.conectar();

    // Só Instagram: outras janelas fecham e outros sites voltam ao login.
    page.context().on("page", (nova) => {
        if (nova !== page) nova.close().catch(() => {});
    });
    page.on("framenavigated", (frame) => {
        if (parado || frame !== page.mainFrame()) return;
        if (!hostPermitido(frame.url())) {
            emOrdem(() => page.goto(INICIO, { waitUntil: "domcontentloaded", timeout: 60000 }));
        }
    });

    await comecarTransmissao();

    return {
        informar(status, mensagem) {
            estado = { status, mensagem };
            canal.enviar("estado", estado);
        },
        async parar() {
            if (parado) return;
            parado = true;
            clearTimeout(agendado);
            await cdp.send("Page.stopScreencast").catch(() => {});
            await cdp.detach().catch(() => {});
            canal.fechar();
        }
    };
}

module.exports = { iniciar, VIEWPORT, hostPermitido, INICIO };
