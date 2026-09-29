/**
 * Script de login manual no Instagram: `npm run login:instagram -w backend`.
 *
 * Abre um navegador visível, espera você entrar na conta (inclusive
 * CAPTCHA/verificação) e salva o estado da sessão em
 * `storage/instagram-auth.json`, que a automação reutiliza.
 *
 * Substitui os antigos `gerar-auth.js` e `login-instagram.js`, que faziam
 * a mesma coisa. Mantenha o arquivo de sessão privado: quem o possui
 * acessa a conta.
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");

const { config } = require("../src/config/env");

/**
 * Exibe uma pergunta e espera o usuário pressionar ENTER.
 *
 * @param {string} mensagem
 * @returns {Promise<void>}
 */
function aguardarEnter(mensagem) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(mensagem, () => {
            rl.close();
            resolve();
        });
    });
}

async function loginInstagram() {
    const arquivo = config.instagram.arquivoSessao;
    let navegador;

    try {
        navegador = await chromium.launch({ headless: false });

        const contexto = await navegador.newContext({
            viewport: { width: 1366, height: 768 },
            locale: "pt-BR"
        });

        const pagina = await contexto.newPage();

        console.log("Abrindo o Instagram...");
        await pagina.goto("https://www.instagram.com/", {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        console.log("\nFaça login manualmente na conta desejada.");
        console.log("Conclua CAPTCHA ou verificações de segurança, se aparecerem.");

        await aguardarEnter(
            "\nQuando estiver dentro da conta, pressione ENTER para salvar a sessão..."
        );

        const campoLogin = pagina
            .locator('input[name="username"], input[name="email"]')
            .first();

        if (
            pagina.url().includes("/accounts/login") ||
            (await campoLogin.isVisible().catch(() => false))
        ) {
            console.log("\nO Instagram ainda parece estar na tela de login.");
            console.log("Conclua o login e execute o script novamente.");
            return;
        }

        fs.mkdirSync(path.dirname(arquivo), { recursive: true });
        await contexto.storageState({ path: arquivo });

        console.log("\nSessão salva com sucesso em:");
        console.log(arquivo);
        console.log("Mantenha esse arquivo privado e nunca o envie ao GitHub.");
    } catch (erro) {
        console.error("\nErro ao gerar a sessão:", erro);
        process.exitCode = 1;
    } finally {
        if (navegador) await navegador.close().catch(() => {});
    }
}

loginInstagram();
