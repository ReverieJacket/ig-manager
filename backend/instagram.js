
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const INSTAGRAM_URL = "https://www.instagram.com/";
const USERNAME = process.env.INSTAGRAM_USERNAME || "bots_at_meta";
const AUTH_PATH = path.resolve(__dirname, "../auth.json");
const LOGS_DIR = path.resolve(__dirname, "logs");

const TIMEOUT = 15000;
const CONFIRMATION_TIMEOUT = 45000;

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function log(message) {
  console.log(`[Instagram] ${message}`);
}

function screenshotPath(prefix) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(LOGS_DIR, `${prefix}-${timestamp}.png`);
}

async function saveScreenshot(page, prefix) {
  try {
    const file = screenshotPath(prefix);
    await page.screenshot({ path: file, fullPage: true });
    log(`Screenshot salvo em: ${file}`);
  } catch (error) {
    log(`Não foi possível salvar screenshot: ${error.message}`);
  }
}

async function restoreSession(context) {
  if (!fs.existsSync(AUTH_PATH)) {
    throw new Error(
      `Sessão não encontrada em ${AUTH_PATH}. Gere o auth.json pelo login manual.`
    );
  }

  let state;
  try {
    state = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8"));
  } catch (error) {
    throw new Error(`Não foi possível ler auth.json: ${error.message}`);
  }

  if (Array.isArray(state.cookies) && state.cookies.length) {
    await context.addCookies(state.cookies);
    log("Cookies da sessão restaurados.");
  }

  const instagramOrigin = state.origins?.find(
    (origin) => origin.origin?.includes("instagram.com")
  );

  if (instagramOrigin?.localStorage?.length) {
    await context.addInitScript((items) => {
      for (const item of items) {
        if (item?.name) {
          localStorage.setItem(item.name, String(item.value ?? ""));
        }
      }
    }, instagramOrigin.localStorage);

    log("Restauração do localStorage configurada.");
  }
}

async function verifyLogin(page) {
  if (/accounts\/login|challenge|checkpoint/i.test(page.url())) {
    throw new Error(
      "O Instagram solicitou login ou verificação manual. Atualize a sessão antes de continuar."
    );
  }

  const loginField = page.locator(
    'input[name="username"], input[name="password"]'
  );

  if (await loginField.count()) {
    if (await loginField.first().isVisible().catch(() => false)) {
      throw new Error(
        "A sessão não está autenticada. Faça login manualmente e atualize o auth.json."
      );
    }
  }

  log("Nenhum formulário de login identificado.");
}

async function clickVisible(locator, description) {
  try {
    const count = await locator.count();

    for (let i = 0; i < count; i++) {
      const element = locator.nth(i);

      if (
        await element.isVisible().catch(() => false) &&
        await element.isEnabled().catch(() => false)
      ) {
        await element.click({ timeout: 5000 });
        log(`Elemento clicado: ${description}`);
        return true;
      }
    }
  } catch (error) {
    log(`Falha ao clicar em ${description}: ${error.message}`);
  }

  return false;
}

async function openCreatePost(page) {
  log("Acessando o perfil.");

  await page.goto(`https://www.instagram.com/${USERNAME}/`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });

  await page.waitForTimeout(4000);
  await verifyLogin(page);

  // Primeiro tenta o caminho que já funcionou no teste anterior.
  try {
    const instagramLink = page.getByRole("link", {
      name: "Instagram",
      exact: true,
    });

    if (await instagramLink.count()) {
      await instagramLink.first().hover({ timeout: 5000 });
      await page.waitForTimeout(1000);
    }

    const newPostLink = page.getByRole("link", {
      name: "Novo post Criar",
    });

    if (await clickVisible(newPostLink, "Novo post Criar")) {
      await page.waitForTimeout(2000);
      return;
    }
  } catch (error) {
    log(`Caminho anterior indisponível: ${error.message}`);
  }

  const candidates = [
    {
      name: "botão Criar",
      locator: () => page.getByRole("button", { name: /criar/i }),
    },
    {
      name: "link Criar",
      locator: () => page.getByRole("link", { name: /criar/i }),
    },
    {
      name: "link de criação",
      locator: () => page.locator('a[href*="/create/"]'),
    },
    {
      name: "elemento aria-label Criar",
      locator: () => page.locator('[aria-label*="Criar" i]'),
    },
    {
      name: "texto Criar",
      locator: () => page.getByText("Criar", { exact: true }),
    },
  ];

  for (const candidate of candidates) {
    if (await clickVisible(candidate.locator(), candidate.name)) {
      await page.waitForTimeout(2000);
      return;
    }
  }

  await saveScreenshot(page, "criar-nao-localizado");
  throw new Error("Não foi possível localizar o botão Criar.");
}

async function findFileInput(page) {
  const selectors = [
    'input[type="file"][accept*="image"]',
    'input[type="file"]',
    '[role="presentation"] input[type="file"]',
  ];

  for (const selector of selectors) {
    const input = page.locator(selector).first();

    try {
      await input.waitFor({ state: "attached", timeout: 5000 });
      return input;
    } catch {
      // Tenta o próximo seletor.
    }
  }

  await saveScreenshot(page, "upload-nao-localizado");
  throw new Error("Campo de upload não encontrado.");
}

async function advanceEditor(page) {
  // O Instagram pode apresentar uma ou mais etapas de edição.
  for (let step = 1; step <= 2; step++) {
    const next = page.getByRole("button", {
      name: /^Avançar$/i,
    });

    if (!(await clickVisible(next, `Avançar - etapa ${step}`))) {
      break;
    }

    await page.waitForTimeout(1800);
  }
}

async function fillCaption(page, caption) {
  const candidates = [
    page.getByRole("textbox", {
      name: /adicione uma legenda/i,
    }),
    page.locator('textarea[aria-label*="legenda" i]'),
    page.locator('[contenteditable="true"][aria-label*="legenda" i]'),
    page.locator('[role="textbox"]'),
  ];

  for (const locator of candidates) {
    try {
      const count = await locator.count();

      for (let i = 0; i < count; i++) {
        const field = locator.nth(i);

        if (await field.isVisible().catch(() => false)) {
          await field.fill(caption, { timeout: 5000 });
          log("Legenda preenchida.");
          return;
        }
      }
    } catch {
      // Tenta o próximo campo.
    }
  }

  await saveScreenshot(page, "legenda-nao-localizada");
  throw new Error("Campo de legenda não encontrado.");
}

/**
 * Procura mensagens explícitas de sucesso.
 * A simples saída do modal não é considerada confirmação suficiente.
 */
async function detectSuccessMessage(page) {
  const successPatterns = [
    /sua publicação foi compartilhada/i,
    /publicação compartilhada/i,
    /sua publicação foi publicada/i,
    /post foi compartilhado/i,
    /your post has been shared/i,
    /your post has been posted/i,
    /post shared/i,
  ];

  for (const pattern of successPatterns) {
    const message = page.getByText(pattern).first();

    if (await message.isVisible().catch(() => false)) {
      return {
        confirmed: true,
        evidence: `Mensagem visível: ${pattern}`,
      };
    }
  }

  return { confirmed: false };
}

/**
 * Aguarda a confirmação visual da publicação.
 * Não trata apenas o clique no botão como sucesso.
 */
async function confirmPublication(page) {
  log("Aguardando confirmação do Instagram.");

  const start = Date.now();

  while (Date.now() - start < CONFIRMATION_TIMEOUT) {
    const success = await detectSuccessMessage(page);

    if (success.confirmed) {
      log(`Publicação confirmada. ${success.evidence}`);
      return {
        confirmed: true,
        evidence: success.evidence,
      };
    }

    // Verifica se o editor continua aberto. Isso é diagnóstico,
    // não uma confirmação de publicação.
    const shareButton = page.getByRole("button", {
      name: /^Compartilhar$/i,
    });

    const editorStillOpen = await shareButton
      .first()
      .isVisible()
      .catch(() => false);

    if (!editorStillOpen) {
      log("Editor fechado; aguardando uma mensagem explícita de confirmação.");
    }

    await page.waitForTimeout(1500);
  }

  return {
    confirmed: false,
    evidence: "Nenhuma mensagem explícita de sucesso foi identificada no prazo.",
  };
}

async function publicarNoInstagram(caminhoImagem, texto, mimetype) {
  let browser;
  let context;
  let page;
  let shareClicked = false;

  try {
    if (!caminhoImagem || typeof caminhoImagem !== "string") {
      throw new Error("Caminho da imagem não informado.");
    }

    if (!fs.existsSync(caminhoImagem)) {
      throw new Error(`Imagem não encontrada: ${caminhoImagem}`);
    }

    if (typeof texto !== "string") {
      throw new Error("A legenda deve ser um texto.");
    }

    log("Iniciando automação.");

    browser = await chromium.launch({
      headless: false,
    });

    context = await browser.newContext({
      viewport: { width: 1365, height: 900 },
    });

    await restoreSession(context);

    page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);

    page.on("pageerror", (error) => {
      log(`Erro da página: ${error.message}`);
    });

    page.on("console", (message) => {
      if (message.type() === "error") {
        log(`Erro de console: ${message.text()}`);
      }
    });

    log("Abrindo Instagram.");

    await page.goto(INSTAGRAM_URL, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    await page.waitForTimeout(3000);
    await verifyLogin(page);

    await openCreatePost(page);

    log("Localizando campo de upload.");

    const fileInput = await findFileInput(page);

    log(`Enviando imagem${mimetype ? ` (${mimetype})` : ""}.`);
    await fileInput.setInputFiles(caminhoImagem);

    await page.waitForTimeout(3000);
    await advanceEditor(page);
    await fillCaption(page, texto);

    log("Localizando botão Compartilhar.");

    const shareButton = page.getByRole("button", {
      name: /^Compartilhar$/i,
    });

    const visible = await shareButton.first()
      .isVisible()
      .catch(() => false);

    if (!visible) {
      await saveScreenshot(page, "compartilhar-nao-localizado");

      throw new Error(
        "Botão Compartilhar não encontrado. O envio não foi iniciado."
      );
    }

    log("Clicando em Compartilhar.");

    await shareButton.first().click({ timeout: 10000 });
    shareClicked = true;

    const confirmation = await confirmPublication(page);

    if (confirmation.confirmed) {
      await saveScreenshot(page, "publicacao-confirmada");

      return {
        sucesso: true,
        incerto: false,
        mensagem: "Publicação confirmada pela mensagem do Instagram.",
        evidencia: confirmation.evidence,
      };
    }

    await saveScreenshot(page, "publicacao-sem-confirmacao");

    return {
      sucesso: false,
      incerto: true,
      mensagem:
        "O botão Compartilhar foi acionado, mas não foi identificada " +
        "uma confirmação explícita do Instagram. Verifique o perfil " +
        "antes de tentar novamente.",
      evidencia: confirmation.evidence,
    };
  } catch (error) {
    log(`Falha na automação: ${error.message}`);

    if (page) {
      await saveScreenshot(page, "falha-publicacao");
    }

    return {
      sucesso: false,
      incerto: shareClicked,
      mensagem: error.message,
    };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }

    if (browser) {
      await browser.close().catch(() => {});
    }

    log("Automação finalizada.");
  }
}

module.exports = {
  publicarNoInstagram,
};