const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

async function publicarNoInstagram(imagem, texto, mimeType) {
    console.log("Iniciando automação do Instagram...");

    const browser = await chromium.launch({
        headless: false
    });

    const context = await browser.newContext({
        storageState: path.resolve(__dirname, "../auth.json"),
        locale: "pt-BR"
    });

    const page = await context.newPage();

    try {
        console.log("Abrindo Instagram...");

        await page.goto("https://www.instagram.com/", {
            waitUntil: "domcontentloaded"
        });

        console.log("Instagram carregado.");

        // Abre o menu de criação
        const botaoCriar = page
            .locator('a:visible, button:visible')
            .filter({ hasText: "Criar" })
            .first();

        await botaoCriar.waitFor({
            state: "visible",
            timeout: 15000
        });

        await botaoCriar.click();

        console.log("Menu de novo post aberto.");

        // Envia a imagem recebida pelo backend
        const extensoes = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp"
        };

        const extensao = extensoes[mimeType] || "jpg";

        const arquivo = fs.readFileSync(imagem);

        await page
            .locator('input[type="file"]')
            .setInputFiles({
                name: `publicacao.${extensao}`,
                mimeType: mimeType,
                buffer: arquivo
            });

        console.log("Imagem enviada.");

        /*await page.screenshot({
            path: path.resolve(__dirname, "debug-upload.png"),
            fullPage: true
        });

        console.log("Botões visíveis após enviar a imagem:");

        const botoes = await page.locator("button:visible").allTextContents();

        console.log(botoes);

        await page.waitForTimeout(30000);*/

        // Primeira etapa
        await page.getByRole("button", {
            name: "Avançar"
        }).click();

        // Segunda etapa
        await page.getByRole("button", {
            name: "Avançar"
        }).click();
        
        console.log("Etapas da imagem concluídas.");

        // Preenche a legenda
        await page
            .getByRole("textbox", {
                name: "Adicione uma legenda..."
            })
            .fill(texto);

        console.log("Legenda preenchida.");

        // Publica
        await page.getByRole("button", {
            name: "Compartilhar"
        }).click();

        console.log("Botão Compartilhar clicado.");

        await page.waitForTimeout(5000);

        console.log("URL atual:", page.url());

        console.log("Textos visíveis após compartilhar:");

        const textos = await page.locator("body").innerText();

        console.log(textos.substring(0, 3000));

        await page.screenshot({
            path: path.resolve(__dirname, "debug-publicacao.png"),
            fullPage: true
        });

        await page.waitForTimeout(10000);

        return {
            sucesso: true,
            mensagem: "Fluxo de publicação executado. Verifique o resultado no Instagram."
        };

    } catch (erro) {

        console.error("Erro ao publicar no Instagram:");
        console.error(erro);

        return {
            sucesso: false,
            mensagem: "Erro ao publicar no Instagram.",
            erro: erro.message
        };

    } finally {

        await browser.close();

        console.log("Navegador encerrado.");
    }
}

module.exports = {
    publicarNoInstagram
};