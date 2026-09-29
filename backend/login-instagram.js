
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

const perfilPath = path.resolve(__dirname, "perfil-instagram");
const authPath = path.resolve(__dirname, "../auth.json");

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
    let contexto;

    try {
        console.log("Iniciando navegador com perfil persistente...");

        contexto = await chromium.launchPersistentContext(perfilPath, {
            headless: false,
            viewport: { width: 1366, height: 768 },
            locale: "pt-BR"
        });

        // Reutiliza a aba inicial, em vez de abrir outra.
        const paginas = contexto.pages();
        const pagina = paginas.length > 0
            ? paginas[0]
            : await contexto.waitForEvent("page", { timeout: 10000 });

        console.log("Abrindo Instagram...");

        await pagina.goto("https://www.instagram.com/", {
            waitUntil: "domcontentloaded",
            timeout: 60000
        });

        console.log("\nFaça login manualmente na conta desejada.");
        console.log("Se aparecer CAPTCHA ou verificação, conclua-a no navegador.");
        console.log("Aguarde até confirmar que está dentro da conta correta.");

        await aguardarEnter(
            "\nQuando o perfil estiver autenticado, pressione ENTER para salvar a sessão..."
        );

        // Verifica se ainda está na tela de login.
        const campoLogin = pagina.locator(
            'input[name="username"], input[name="email"]'
        ).first();

        if (
            pagina.url().includes("/accounts/login") ||
            await campoLogin.isVisible().catch(() => false)
        ) {
            console.log(
                "\nO Instagram ainda parece estar na tela de login."
            );
            console.log(
                "Conclua o login manualmente e execute novamente, se necessário."
            );
            return;
        }

        // Exporta o estado de autenticação para o teste Playwright.
        await contexto.storageState({
            path: authPath
        });

        if (!fs.existsSync(authPath)) {
            throw new Error("O arquivo auth.json não foi criado.");
        }

        console.log("\nSessão salva com sucesso!");
        console.log("Arquivo:", authPath);
        console.log("Perfil persistente:", perfilPath);
        console.log("Não compartilhe esses arquivos nem os envie ao GitHub.");

    } catch (erro) {
        console.error("\nErro ao gerar a sessão:", erro);
    } finally {
        if (contexto) {
            await contexto.close().catch((erro) => {
                console.error("Erro ao fechar o navegador:", erro.message);
            });
        }
    }
}

loginInstagram();