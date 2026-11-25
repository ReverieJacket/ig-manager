/**
 * Publicador que conversa com o site (app instalado): não tem a chave do
 * banco, só o login do administrador. Cada operação é uma chamada às rotas
 * `/api/publicador/*` com o token da sessão.
 */
const fs = require("fs");
const path = require("path");

const { config } = require("../config/env");

/** Login expirado ou revogado (ex.: senha trocada): o app pede login de novo. */
class ErroSessao extends Error {
    constructor(mensagem) {
        super(mensagem || "Sua sessão expirou. Entre de novo no IG Manager Publicador.");
        this.name = "ErroSessao";
        this.sessao = true;
    }
}

/**
 * @param {{site: string, token: string, aoPerderSessao?: () => void}} opcoes
 */
function criarPortaRemota({ site, token, aoPerderSessao = () => {} }) {
    const base = `${String(site).replace(/\/+$/, "")}/api`;

    async function chamar(metodo, caminho, corpo) {
        let resposta;
        try {
            resposta = await fetch(base + caminho, {
                method: metodo,
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(corpo !== undefined ? { "Content-Type": "application/json" } : {})
                },
                body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
                signal: AbortSignal.timeout(60 * 1000)
            });
        } catch (erro) {
            throw new Error(`Sem conexão com o site (${base}): ${erro.message}`);
        }

        let dados = null;
        try {
            dados = await resposta.json();
        } catch {
            dados = null;
        }

        if (resposta.status === 401) {
            aoPerderSessao();
            throw new ErroSessao(dados?.mensagem);
        }
        if (!resposta.ok) {
            const erro = new Error(dados?.mensagem || `O site respondeu ${resposta.status}.`);
            erro.status = resposta.status;
            throw erro;
        }
        return dados;
    }

    return {
        tipo: "remota",
        site,
        eu: () => chamar("GET", "/publicador/eu"),
        iniciar: (dados) => chamar("POST", "/publicador/inicio", dados || {}),
        sinalizar: () => chamar("POST", "/publicador/sinal", {}),
        desligar: () => chamar("POST", "/publicador/desligar", {}),
        vencidas: async () => (await chamar("GET", "/publicador/vencidas")).itens,
        tratar: (id, acordadoDesde) => chamar("POST", `/publicador/publicacoes/${id}/tratar`, { acordadoDesde }),
        registrarResultado: (id, resultado) => chamar("POST", `/publicador/publicacoes/${id}/resultado`, resultado),

        /** Baixa a imagem do Storage para a pasta de dados deste computador. */
        async baixarImagem(publicacao) {
            const nome = path.basename(String(publicacao.imagem || ""));
            const destino = path.join(config.diretorios.uploads, nome);
            if (nome && fs.existsSync(destino)) return destino;

            const { link } = await chamar("GET", `/publicador/publicacoes/${publicacao.id}/imagem`);
            const resposta = await fetch(link, { signal: AbortSignal.timeout(120 * 1000) });
            if (!resposta.ok) throw new Error(`Não foi possível baixar a imagem (${resposta.status}).`);

            fs.mkdirSync(config.diretorios.uploads, { recursive: true });
            fs.writeFileSync(destino, Buffer.from(await resposta.arrayBuffer()));
            return destino;
        },

        atrasadas: async () => (await chamar("GET", "/publicador/atrasadas")).itens,
        proximas: async () => (await chamar("GET", "/publicador/proximas")).itens,
        retomar: (id, dados) => chamar("POST", `/publicacoes/${id}/retomar`, dados),

        tarefasPendentes: async () => (await chamar("GET", "/publicador/tarefas")).itens,
        pegarTarefa: async (id) => (await chamar("POST", `/publicador/tarefas/${id}/pegar`, {})).pedido,
        informarTarefa: (id, mensagem) => chamar("POST", `/publicador/tarefas/${id}/informar`, { mensagem }),
        concluirTarefa: (id, fim) => chamar("POST", `/publicador/tarefas/${id}/concluir`, fim),

        contasAtivas: async () => (await chamar("GET", "/publicador/contas")).itens,
        contaParaConectar: async (id) => (await chamar("GET", `/publicador/contas/${id}`)).conta,
        definirSessao: (id, quando) => chamar("POST", `/publicador/contas/${id}/sessao`, { salvaEm: quando || null }),
        salvarComentarios: (id, coleta) => chamar("POST", `/publicador/publicacoes/${id}/comentarios`, coleta)
    };
}

/**
 * Login do app: troca e-mail e senha de administrador por um token.
 *
 * @returns {Promise<{token: string, usuario: object}>}
 */
async function entrar(site, email, senha) {
    return pedirLogin(site, "entrar", { email, senha });
}

/**
 * Cria a conta de administrador (e um espaço novo) e já entra.
 *
 * @param {string} site
 * @param {{nome: string, empresa?: string, email: string, senha: string}} dados
 */
async function cadastrar(site, dados) {
    return pedirLogin(site, "cadastrar", dados);
}

async function pedirLogin(site, acao, corpo) {
    const base = `${String(site).replace(/\/+$/, "")}/api`;
    let resposta;
    try {
        resposta = await fetch(`${base}/publicador/${acao}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo),
            signal: AbortSignal.timeout(30 * 1000)
        });
    } catch (erro) {
        throw new Error(`Não foi possível acessar ${site}. Confira o endereço e a internet.`);
    }
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) throw new Error(dados?.mensagem || `O site respondeu ${resposta.status}.`);
    return { token: dados.token, usuario: dados.usuario };
}

module.exports = { criarPortaRemota, entrar, cadastrar, ErroSessao };
