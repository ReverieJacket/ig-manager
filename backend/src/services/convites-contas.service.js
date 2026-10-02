/**
 * Convites públicos para cadastro de contas Instagram.
 * O token em texto puro só é devolvido na criação; no banco fica seu SHA-256.
 */
const crypto = require("crypto");
const contasRepository = require("../repositories/contas.repository");
const { ErroHttp } = require("../lib/erros");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function validarToken(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    throw new ErroHttp(404, "Link de cadastro inválido ou inexistente.");
  }
}
function estadoConvite(convite) {
  if (!convite) throw new ErroHttp(404, "Link de cadastro inválido ou inexistente.");
  if (convite.used_at) throw new ErroHttp(410, "Este link já foi utilizado.");
  if (new Date(convite.expires_at).getTime() <= Date.now()) {
    throw new ErroHttp(410, "Este link expirou. Solicite um novo convite ao administrador.");
  }
  return convite;
}
async function gerar({ cliente, validadeHoras }) {
  const nomeCliente = String(cliente || "").trim();
  const horas = Number(validadeHoras);
  if (!nomeCliente || nomeCliente.length > 120) throw new ErroHttp(400, "Informe um nome de cliente válido.");
  if (![24, 72, 168].includes(horas)) throw new ErroHttp(400, "Validade inválida. Escolha 24 horas, 3 dias ou 7 dias.");
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + horas * 60 * 60 * 1000).toISOString();
  const convite = await contasRepository.criarConvite({
    cliente: nomeCliente,
    token_hash: hashToken(token),
    expires_at: expiresAt
  });
  const baseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
  return { ...convite, url: `${baseUrl}/cadastro-conta/${token}` };
}
async function consultar(token) {
  validarToken(token);
  const convite = estadoConvite(await contasRepository.buscarConvitePorHash(hashToken(token)));
  return { cliente: convite.cliente, expires_at: convite.expires_at };
}
async function cadastrar(token, dados) {
  validarToken(token);
  const convite = estadoConvite(await contasRepository.buscarConvitePorHash(hashToken(token)));
  const nome = String(dados?.nome || "").trim();
  const username = String(dados?.username || "").trim().replace(/^@+/, "").toLowerCase();
  if (!nome || nome.length > 120) throw new ErroHttp(400, "Informe um nome válido para a conta.");
  if (!username || username.length > 30 || !/^[a-z0-9._]+$/.test(username)) {
    throw new ErroHttp(400, "Informe um usuário válido do Instagram.");
  }
  if (await contasRepository.buscarPorUsername(username)) {
    throw new ErroHttp(409, "Este usuário do Instagram já está cadastrado.");
  }
  // Consome o convite uma única vez antes de criar a conta.
  const consumido = await contasRepository.marcarConviteUtilizado(convite.id);
  if (!consumido) throw new ErroHttp(409, "Este link já foi utilizado.");
  try {
    return await contasRepository.criar({ cliente: convite.cliente, nome, username });
  } catch (erro) {
    // Não reabre o convite automaticamente: evita reutilização concorrente.
    throw erro;
  }
}
module.exports = { gerar, consultar, cadastrar };
