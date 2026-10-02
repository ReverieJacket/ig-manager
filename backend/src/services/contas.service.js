/**
 * Regras de negócio para contas do Instagram.
 */
const contasRepository = require("../repositories/contas.repository");
const { ErroHttp } = require("../lib/erros");

function listarContasAtivas() {
    return contasRepository.listarAtivas();
}

async function buscarContaAtiva(id) {
    const conta = await contasRepository.buscarPorId(id);
    return conta && conta.ativo ? conta : null;
}

/** Valida e cadastra uma conta; não recebe nem armazena senha do Instagram. */
async function cadastrarConta(dados) {
    const cliente = String(dados?.cliente || "").trim();
    const nome = String(dados?.nome || "").trim();
    const username = String(dados?.username || "").trim().replace(/^@+/, "").toLowerCase();

    if (!cliente) throw new ErroHttp(400, "Informe o cliente.");
    if (!nome) throw new ErroHttp(400, "Informe o nome da conta.");
    if (!username) throw new ErroHttp(400, "Informe o usuário do Instagram.");
    if (cliente.length > 120) throw new ErroHttp(400, "O nome do cliente deve ter até 120 caracteres.");
    if (nome.length > 120) throw new ErroHttp(400, "O nome da conta deve ter até 120 caracteres.");
    if (username.length > 30 || !/^[a-z0-9._]+$/.test(username)) {
        throw new ErroHttp(400, "Informe um nome de usuário válido do Instagram (até 30 caracteres, letras, números, pontos e sublinhados).");
    }

    const existente = await contasRepository.buscarPorUsername(username);
    if (existente) throw new ErroHttp(409, "Já existe uma conta cadastrada com esse nome de usuário.");

    return contasRepository.criar({ cliente, nome, username });
}

module.exports = { listarContasAtivas, buscarContaAtiva, cadastrarConta };
