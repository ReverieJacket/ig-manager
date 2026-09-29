
const { chromium } = require("playwright");
const path = require("path");
const readline = require("readline");

async function gerarSessao() {
    const navegador = await chromium.launch({
        headless: false
    });

    const contexto = await navegador.newContext({
        locale: "pt-BR"
    });

    const pagina = await contexto.newPage();

    try {
        console.log("Abrindo o Instagram...");
        await pagina.goto("https://www.instagram.com/", {
            waitUntil: "domcontentloaded"
        });

        console.log("\nFaça login manualmente no Instagram.");
        console.log("Conclua também qualquer verificação de segurança, se aparecer.");

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        await new Promise((resolve) => {
            rl.question(
                "\nDepois de entrar na conta correta, pressione ENTER aqui para salvar a sessão...",
                () => {
                    rl.close();
                    resolve();
                }
            );
        });

        const caminhoAuth = path.resolve(__dirname, "../auth.json");

        await contexto.storageState({
            path: caminhoAuth
        });

        console.log("\nSessão salva com sucesso em:");
        console.log(caminhoAuth);
        console.log("Mantenha esse arquivo privado e não o envie ao GitHub.");
    } catch (erro) {
        console.error("Erro ao gerar a sessão:", erro);
    } finally {
        await navegador.close();
    }
}

gerarSessao();