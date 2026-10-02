/**
 * Autenticacao local de contas Instagram via navegador Playwright.
 * O navegador roda na maquina do backend; nao armazena senhas.
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { obterArquivoSessao } = require("../automacao/instagram/sessao");
const contasService = require("./contas.service");

const processos = new Map();

async function iniciar(contaId) {
  const id = Number(contaId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    const e = new Error("ID da conta invalido."); e.status = 400; throw e;
  }
  const conta = await contasService.buscarContaAtiva(id);
  if (!conta) { const e = new Error("Conta nao encontrada ou inativa."); e.status = 404; throw e; }
  if (processos.has(id)) return estado(id);

  const p = { contaId:id, username:conta.username, status:"iniciando", mensagem:"Abrindo navegador", browser:null, context:null, page:null, timer:null };
  processos.set(id,p);
  try {
    p.browser = await chromium.launch({headless:false});
    p.context = await p.browser.newContext({viewport:{width:1366,height:768},locale:"pt-BR"});
    p.page = await p.context.newPage();
    await p.page.goto("https://www.instagram.com/", {waitUntil:"domcontentloaded",timeout:60000});
    p.status = "aguardando_login";
    p.mensagem = "Entre na conta no navegador aberto. A sessao sera salva automaticamente.";
    // Verifica periodicamente, sem exigir ENTER no terminal.
    p.timer = setInterval(() => concluirSeAutenticado(p).catch(() => {}), 2500);
    return estado(id);
  } catch (e) {
    await encerrar(p); processos.delete(id); throw e;
  }
}

async function concluirSeAutenticado(p) {
  if (p.status !== "aguardando_login") return;
  if (!p.page || p.page.isClosed()) {
    p.status="cancelado"; p.mensagem="Navegador fechado antes da autenticacao."; await encerrar(p); return;
  }
  const url=p.page.url();
  const login = /accounts\\/(login|challenge|two_factor)/i.test(url) ||
    await p.page.locator('input[name="username"], input[name="password"]').first().isVisible().catch(()=>false);
  if (login) return;
  // Sinal conservador: exige elemento de navegacao autenticada, nao apenas URL fora do login.
  const autenticado = await p.page.locator('a[href*="/direct/inbox"], a[href*="/accounts/edit"], svg[aria-label="Home"]').first().isVisible().catch(()=>false);
  if (!autenticado) return;
  const file=obterArquivoSessao(p.contaId);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  await p.context.storageState({path:file});
  p.status="conectado"; p.mensagem="Sessao salva. Confira se o perfil aberto corresponde a conta cadastrada.";
  await encerrar(p);
}

function estado(id) {
  const p=processos.get(Number(id));
  return p ? {contaId:p.contaId,username:p.username,status:p.status,mensagem:p.mensagem} :
    {contaId:Number(id),status:"desconectado",mensagem:"Nenhum processo de conexao ativo."};
}
async function consultar(id) {
  const n = Number(id);
  const p = processos.get(n);

  if (p) {
    await concluirSeAutenticado(p);
    return estado(n);
  }

  // Recupera o status após navegar para outra tela ou reiniciar o backend.
  // A existência do arquivo indica sessão salva, não validação em tempo real.
  const file = obterArquivoSessao(n);
  if (fs.existsSync(file)) {
    return {
      contaId: n,
      status: "conectado",
      mensagem: "Sessão salva localmente; será validada ao utilizar a conta."
    };
  }

  return estado(n);
}
async function encerrar(p) {
  if(p.timer) clearInterval(p.timer);
  if(p.browser) await p.browser.close().catch(()=>{});
  p.timer=null; p.browser=null;
}
async function desconectar(id) {
  const n=Number(id), p=processos.get(n);
  if(p) { await encerrar(p); processos.delete(n); }
  const file=obterArquivoSessao(n);
  if(fs.existsSync(file)) fs.unlinkSync(file);
  return {contaId:n,status:"desconectado",mensagem:"Sessao local removida."};
}
module.exports={iniciar,consultar,desconectar};
