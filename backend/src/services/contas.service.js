/**
 * Serviço de contas do Instagram.
 */
const contasRepository = require("../repositories/contas.repository");

/**
 * Lista as contas que podem receber publicações.
 *
 * @returns {Promise<object[]>}
 */
function listarContasAtivas() {
    return contasRepository.listarAtivas();
}

/**
 * Retorna a conta apenas se ela existir e estiver ativa.
 *
 * Centraliza uma regra que antes era repetida na criação e na execução
 * da publicação (a conta pode ser desativada entre o agendamento e a
 * execução, por isso ambos os momentos precisam checar).
 *
 * @param {number} id - Identificador da conta.
 * @returns {Promise<object|null>} A conta ativa, ou `null`.
 */
async function buscarContaAtiva(id) {
    const conta = await contasRepository.buscarPorId(id);

    return conta && conta.ativo ? conta : null;
}

module.exports = { listarContasAtivas, buscarContaAtiva };
