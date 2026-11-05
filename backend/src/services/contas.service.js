/**
 * Regras de negócio para contas do Instagram.
 */
const contasRepository = require("../repositories/contas.repository");
const clientesRepository = require("../repositories/clientes.repository");
const { ErroHttp } = require("../lib/erros");

function listarContasAtivas() {
    return contasRepository.listarAtivas();
}

async function buscarContaAtiva(id) {
    const conta = await contasRepository.buscarPorId(id);
    return conta && conta.ativo ? conta : null;
}

/**
 * Valida nome e @ de uma conta e confere se o @ ainda não foi cadastrado.
 *
 * @returns {Promise<{nome: string, username: string}>}
 */
async function validarNovaConta(dados) {
    const nome = String(dados?.nome || "").trim();
    const username = String(dados?.username || "").trim().replace(/^@+/, "").toLowerCase();

    if (!nome) throw new ErroHttp(400, "Informe o nome do perfil.");
    if (!username) throw new ErroHttp(400, "Informe o usuário do Instagram.");
    if (nome.length > 120) throw new ErroHttp(400, "O nome do perfil deve ter até 120 caracteres.");
    if (username.length > 30 || !/^[a-z0-9._]+$/.test(username)) {
        throw new ErroHttp(400, "Informe um nome de usuário válido do Instagram (até 30 caracteres, letras, números, pontos e sublinhados).");
    }

    const existente = await contasRepository.buscarPorUsername(username);
    if (existente) throw new ErroHttp(409, "Já existe um perfil cadastrado com esse usuário do Instagram.");

    return { nome, username };
}

/** Valida e cadastra uma conta; não recebe nem armazena senha do Instagram. */
async function cadastrarConta(dados) {
    const cliente = String(dados?.cliente || "").trim();

    if (!cliente) throw new ErroHttp(400, "Informe o cliente.");
    if (cliente.length > 120) throw new ErroHttp(400, "O nome do cliente deve ter até 120 caracteres.");

    const { nome, username } = await validarNovaConta(dados);

    // O nome digitado aponta para o cliente existente (ou cria um novo).
    const registroCliente = await clientesRepository.buscarOuCriarPorNome(cliente);

    return contasRepository.criar({
        cliente: registroCliente.nome,
        clienteId: registroCliente.id,
        nome,
        username
    });
}

/**
 * Cadastro feito pelo próprio cliente (área do cliente). O cliente vem da
 * sessão, nunca do corpo da requisição.
 *
 * @param {{id: number, nome: string, cliente: {id: number, nome: string}}} usuario
 * @param {{nome: string, username: string}} dados
 */
async function cadastrarContaDoCliente(usuario, dados) {
    const { nome, username } = await validarNovaConta(dados);

    return contasRepository.criar({
        cliente: usuario.cliente.nome,
        clienteId: usuario.cliente.id,
        cadastradaPor: usuario.id,
        nome,
        username
    });
}

module.exports = {
    listarContasAtivas,
    buscarContaAtiva,
    validarNovaConta,
    cadastrarConta,
    cadastrarContaDoCliente
};
