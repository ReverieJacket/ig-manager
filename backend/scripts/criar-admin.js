/**
 * Cria um administrador, ou redefine a senha de um que já existe:
 *
 *   npm run criar:admin -- --email voce@empresa.com --nome "Seu Nome"
 *
 * A senha é pedida no terminal (sem aparecer na tela), para não ficar
 * gravada no histórico de comandos.
 */
const readline = require("readline");

const { gerarHash, validarSenhaNova } = require("../src/lib/senhas");
const usuariosRepository = require("../src/repositories/usuarios.repository");

function lerArgumento(nome) {
    const indice = process.argv.indexOf(`--${nome}`);
    return indice === -1 ? undefined : process.argv[indice + 1];
}

/** Pergunta algo no terminal; com `oculto`, não mostra o que é digitado. */
function perguntar(texto, { oculto = false } = {}) {
    return new Promise((resolver) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true
        });

        if (oculto) {
            rl._writeToOutput = (saida) => {
                if (saida.startsWith(texto)) rl.output.write(texto);
            };
        }

        rl.question(texto, (resposta) => {
            rl.close();
            if (oculto) process.stdout.write("\n");
            resolver(resposta);
        });
    });
}

async function principal() {
    const email = usuariosRepository.normalizarEmail(
        lerArgumento("email") || (await perguntar("E-mail: "))
    );

    if (!email.includes("@")) throw new Error("Informe um e-mail válido.");

    const existente = await usuariosRepository.buscarPorEmail(email);

    if (existente && existente.perfil !== "admin") {
        throw new Error(`O e-mail ${email} pertence a um usuário cliente; use outro e-mail.`);
    }

    const nome = existente
        ? existente.nome
        : String(lerArgumento("nome") || (await perguntar("Nome: "))).trim();

    if (!nome) throw new Error("Informe o nome.");

    const senha = await perguntar("Senha (mín. 8 caracteres): ", { oculto: true });
    const erroSenha = validarSenhaNova(senha);
    if (erroSenha) throw new Error(erroSenha);

    const confirmacao = await perguntar("Repita a senha: ", { oculto: true });
    if (confirmacao !== senha) throw new Error("As senhas não conferem.");

    const senha_hash = await gerarHash(senha);

    if (existente) {
        await usuariosRepository.atualizar(existente.id, { senha_hash, ativo: true });
        console.log(`Senha do administrador ${email} redefinida.`);
    } else {
        await usuariosRepository.criar({ nome, email, senha_hash, perfil: "admin", cliente_id: null });
        console.log(`Administrador ${email} criado. Já pode entrar no sistema.`);
    }
}

principal().catch((erro) => {
    console.error("Erro:", erro.message || erro);
    process.exitCode = 1;
});
