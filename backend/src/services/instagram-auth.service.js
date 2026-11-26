/**
 * Conexão de perfis do Instagram: abre o Chromium NESTE computador para o
 * login manual e salva a sessão em arquivo (nenhuma senha é guardada).
 *
 * Roda no Publicador (ou no backend no modo "completo"). O Playwright só é
 * carregado ao abrir o navegador: o site na Vercel nunca precisa dele.
 *
 * Ao salvar ou apagar a sessão, o banco é avisado (`sessao_salva_em`,
 * migração 011) para o site mostrar o perfil como conectado ou não.
 */
const fs = require("fs");
const path = require("path");

const { obterArquivoSessao } = require("../automacao/instagram/sessao");
const { config } = require("../config/env");
const { ErroHttp } = require("../lib/erros");
const { criarLogger } = require("../lib/logger");
const log = criarLogger("Conexao");
const processos = new Map();

/**
 * Onde buscar o perfil e avisar sobre a sessão. Padrão: o banco direto
 * (backend completo / npm run publicador). O app Publicador instalado troca
 * por chamadas ao site (`configurar`), pois não tem a chave do banco.
 */
let dados = null;

function porta() {
  if (!dados) {
    const contasService = require("./contas.service");
    const contasRepository = require("../repositories/contas.repository");
    dados = {
      buscarConta: (id) => contasService.buscarContaAtiva(id),
      sessaoSalva: async (id) => {
        await contasRepository.limparSessaoExpirada(id).catch(() => {});
        await contasRepository.definirSessaoSalva(id, new Date().toISOString());
      },
      sessaoRemovida: async (id) => {
        await contasRepository.limparSessaoExpirada(id).catch(() => {});
        await contasRepository.definirSessaoSalva(id, null);
      }
    };
  }
  return dados;
}

/** Troca a origem dos dados (app Publicador: o site, por login). */
function configurar(novos) {
  dados = novos;
}

/** Avisa o banco; sem a migração 011 apenas registra (o arquivo vale igual). */
async function avisar(fn, id) {
  try {
    await fn(id);
  } catch (erro) {
    log.aviso(`Perfil ${id}: não foi possível registrar a sessão (migração 011?)`, erro?.message);
  }
}

/**
 * @param {number} contaId
 * @param {{remoto?: {url: string, chave: string, canal: string}}} [opcoes] -
 *   Com `remoto`, o navegador abre escondido e a tela vai para o site de quem
 *   clicou em "Conectar" (automacao/instagram/tela-remota).
 */
async function iniciar(contaId, { remoto = null } = {}) {
  const id = Number(contaId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ErroHttp(400, "ID da conta inválido.");
  }
  if (!config.conexaoNoServidor && !remoto) {
    throw new ErroHttp(
      409,
      "Neste servidor não há tela para abrir o Instagram. Conecte o perfil no seu computador " +
      "(npm run login:instagram -- --conta " + id + ") e use \"Enviar sessão\" no menu ⋯ do perfil."
    );
  }
  const conta = await porta().buscarConta(id);
  if (!conta) throw new ErroHttp(404, "Conta não encontrada ou inativa.");
  if (processos.has(id)) return estado(id);

  const { chromium } = require("playwright");
  const p = { contaId: id, username: conta.username, status: "iniciando", mensagem: "Abrindo navegador", browser: null, context: null, page: null, timer: null, tela: null };
  processos.set(id, p);
  try {
    p.browser = await chromium.launch({ headless: Boolean(remoto), channel: process.env.IG_NAVEGADOR_CANAL || undefined });
    if (remoto) {
      const telaRemota = require("../automacao/instagram/tela-remota");
      p.context = await p.browser.newContext({ viewport: telaRemota.VIEWPORT, locale: "pt-BR" });
      p.page = await p.context.newPage();
      p.tela = await telaRemota.iniciar(p.page, remoto, {
        log,
        aoCancelar: () => {
          p.status = "cancelado";
          p.mensagem = "Conexão cancelada por quem estava conectando.";
          p.tela?.informar(p.status, p.mensagem);
          encerrar(p).catch(() => {});
        }
      });
      await p.page.goto(telaRemota.INICIO, { waitUntil: "domcontentloaded", timeout: 60000 });
      p.usuarioPreenchido = await preencherUsuario(p.page, conta.username);
    } else {
      p.context = await p.browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "pt-BR" });
      p.page = await p.context.newPage();
      await p.page.goto("https://www.instagram.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
    }
    p.status = "aguardando_login";
    p.mensagem = remoto
      ? (p.usuarioPreenchido
        ? `O usuário @${conta.username} já está preenchido. Toque no campo da senha, digite a sua senha e toque em Entrar.`
        : `Toque no campo do usuário, digite @${conta.username}, depois a senha, e toque em Entrar.`)
      : `Entre na conta @${conta.username} no navegador aberto. A sessão será salva automaticamente.`;
    p.tela?.informar(p.status, p.mensagem);
    // Verifica periodicamente, sem exigir ENTER no terminal.
    p.timer = setInterval(() => concluirSeAutenticado(p).catch(() => {}), 2500);
    return estado(id);
  } catch (e) {
    await encerrar(p); processos.delete(id); throw e;
  }
}

/**
 * Tela remota: já deixa o @ do perfil no campo de usuário, para a pessoa só
 * digitar a senha. Se a página do Instagram mudar, apenas não preenche.
 */
async function preencherUsuario(page, username) {
  try {
    const campo = page
      .locator('input[name="username"], input[name="email"], input[autocomplete="username"], form input[type="text"]')
      .first();
    await campo.waitFor({ state: "visible", timeout: 20000 });
    await campo.fill(username);
    return true;
  } catch {
    return false;
  }
}

async function concluirSeAutenticado(p) {
  if (p.status !== "aguardando_login") return;
  if (!p.page || p.page.isClosed()) {
    p.status = "cancelado"; p.mensagem = "Navegador fechado antes da autenticação."; await encerrar(p); return;
  }
  const url = p.page.url();
  const login = /accounts\/(login|challenge|two_factor)/i.test(url) ||
    await p.page.locator('input[name="username"], input[name="password"]').first().isVisible().catch(() => false);
  if (login) return;
  // Sinal conservador: exige elemento de navegação autenticada, não apenas URL fora do login.
  const autenticado = await p.page.locator('a[href*="/direct/inbox"], a[href*="/accounts/edit"], svg[aria-label="Home"]').first().isVisible().catch(() => false);
  if (!autenticado) return;
  const file = obterArquivoSessao(p.contaId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await p.context.storageState({ path: file });
  // Sessão nova: o perfil deixa de aparecer como "Sessão expirada".
  await avisar(porta().sessaoSalva, p.contaId);
  p.status = "conectado"; p.mensagem = "Sessão salva. Confira se o perfil aberto corresponde à conta cadastrada.";
  p.tela?.informar(p.status, "Pronto! O perfil foi conectado.");
  await encerrar(p);
}

function estado(id) {
  const p = processos.get(Number(id));
  return p ? { contaId: p.contaId, username: p.username, status: p.status, mensagem: p.mensagem } :
    { contaId: Number(id), status: "desconectado", mensagem: "Nenhum processo de conexão ativo." };
}

async function consultar(id) {
  const n = Number(id);
  const p = processos.get(n);

  if (p) {
    await concluirSeAutenticado(p);
    const atual = estado(n);
    // Terminou (conectado/cancelado): libera para uma nova tentativa.
    if (!["iniciando", "aguardando_login"].includes(p.status)) processos.delete(n);
    return atual;
  }

  // Recupera o status após navegar para outra tela ou reiniciar o backend.
  // A existência do arquivo indica sessão salva, não validação em tempo real.
  if (contaConectada(n)) {
    return {
      contaId: n,
      status: "conectado",
      mensagem: "Sessão salva localmente; será validada ao utilizar a conta."
    };
  }

  return estado(n);
}

async function encerrar(p) {
  if (p.timer) clearInterval(p.timer);
  if (p.tela) await p.tela.parar().catch(() => {});
  p.tela = null;
  if (p.browser) await p.browser.close().catch(() => {});
  p.timer = null; p.browser = null;
}

/** Fecha só o navegador de uma conexão em andamento (tempo esgotado). */
async function desconectarProcesso(id) {
  const n = Number(id), p = processos.get(n);
  if (p) {
    p.tela?.informar("cancelado", "Tempo esgotado: o login não foi concluído.");
    await encerrar(p); processos.delete(n);
  }
}

async function desconectar(id) {
  const n = Number(id);
  await desconectarProcesso(n);
  const file = obterArquivoSessao(n);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  await avisar(porta().sessaoRemovida, n);
  return { contaId: n, status: "desconectado", mensagem: "Sessão local removida." };
}

/**
 * Indica se a conta já tem sessão do Instagram salva NESTE computador.
 * Não valida a sessão em tempo real; ela é conferida ao publicar.
 */
function contaConectada(id) {
  try { return fs.existsSync(obterArquivoSessao(id)); } catch { return false; }
}

module.exports = { iniciar, consultar, desconectar, desconectarProcesso, contaConectada, configurar };
