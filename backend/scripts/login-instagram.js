/**
 * Script de login manual no Instagram, UMA sessão por conta:
 *
 *     npm run login:instagram -- --conta 1
 *
 * `--conta` é o `id` da conta na tabela `contas_instagram`. O script abre
 * um navegador visível, espera você entrar NAQUELA conta (inclusive
 * CAPTCHA/verificação) e salva o estado da sessão em
 * `storage/instagram-sessoes/conta-<id>.json`, que a automação reutiliza.
 *
 * Mantenha o arquivo de sessão privado: quem o possui acessa a conta.
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");

const { obterArquivoSessao } = require("../src/automacao/instagram/sessao");

/**
 * Lê o valor de `--conta` (ou `--conta=<id>`) da linha de comando.
 *
 * @returns {number} Id da conta.
 * @throws {Error} Se ausente ou inválido.
 */
function lerContaDosArgumentos() {
    const args = process.argv.slice(2);
    const indice = args.findIndex((a) => a === "--conta" || a.startsWith("--conta="));
    const bruto = indice === -1
        ? undefined
        : args[indice].includes("=") ? args[indice].split("=")[1] : args[indice + 1];
    const id = Number(bruto);

    if (!Number.isSafeInteger(id) || id <= 0) {
        const erro = new Error(
            "Informe a conta: npm run login:instagram -- --conta <id> " +
            "(o id está na tabela contas_instagram)."
        );

        erro.uso = true;
        throw erro;
    }

    return id;
}

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
    let navegador;

    try {
        const contaId = lerContaDosArgumentos();
        const arquivo = obterArquivoSessao(contaId);

        console.log(`Conectando a conta ${contaId}. Entre SOMENTE nela.`);
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
        // Erro de uso (argumento ausente): só a mensagem, sem pilha.
        console.error("\nErro ao gerar a sessão:", erro.uso ? erro.message : erro);
        process.exitCode = 1;
    } finally {
        if (navegador) await navegador.close().catch(() => {});
    }
}

loginInstagram();
