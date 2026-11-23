/**
 * Configuração central do backend.
 *
 * Este é o único módulo que lê `process.env` e conhece caminhos do disco.
 * Os demais módulos importam daqui, o que evita valores "mágicos"
 * espalhados pelo código (12-factor app: configuração via ambiente).
 *
 * O arquivo `.env` é procurado em `backend/.env` (veja `.env.example`).
 */
const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../../.env"),
    quiet: true
});

/** Raiz do pacote backend (pasta que contém `package.json`). */
const RAIZ_BACKEND = path.resolve(__dirname, "../..");

/**
 * Pasta de dados gerados em tempo de execução (uploads, logs e sessão).
 * Fica fora do controle de versão (ver `.gitignore`).
 */
// O app Publicador instalado guarda os dados em AppData (IG_PASTA_DADOS).
const DIRETORIO_STORAGE = process.env.IG_PASTA_DADOS
    ? path.resolve(process.env.IG_PASTA_DADOS)
    : path.join(RAIZ_BACKEND, "storage");

const emProducao = process.env.NODE_ENV === "production";

/**
 * Como este processo roda (IG_MODO):
 * - "completo"  (padrão): API + Publicador no mesmo processo, como no
 *   computador de desenvolvimento;
 * - "api":        só a API (site na Vercel). Não abre navegador: publicar,
 *   conectar e coletar comentários viram pedidos para o Publicador;
 * - "publicador": só o Publicador (app no computador do administrador).
 */
const MODOS = Object.freeze({ COMPLETO: "completo", API: "api", PUBLICADOR: "publicador" });
const modo = Object.values(MODOS).includes(process.env.IG_MODO) ? process.env.IG_MODO : MODOS.COMPLETO;

const config = {
    emProducao,

    modo,

    /**
     * Imagens das postagens no Supabase Storage (bucket `publicacoes`) em
     * vez da pasta storage/uploads. Obrigatório na Vercel (sem disco).
     */
    imagensNoSupabase: modo === MODOS.API || process.env.IMAGENS_NO_SUPABASE === "true",
    bucketImagens: "publicacoes",

    /** Ritmo do Publicador e quando ele é considerado desligado. */
    publicador: {
        intervaloPublicacoesMs: 15 * 1000,
        intervaloTarefasMs: 4 * 1000,
        intervaloSinalMs: 30 * 1000,
        /** Sem sinal há mais que isso: "Publicador desligado". */
        limiteSemSinalMs: 90 * 1000
    },

    porta: Number(process.env.PORT || 3000),

    log: {
        /** debug | info | warn | error | silent. Padrão: debug em desenvolvimento, info em produção. */
        nivel: process.env.LOG_LEVEL || (emProducao ? "info" : "debug"),
        /** Se "true", grava também em storage/logs/backend.log (formato JSON). */
        emArquivo: process.env.LOG_EM_ARQUIVO === "true",
        arquivo: path.join(DIRETORIO_STORAGE, "logs", "backend.log")
    },

    /** URL do frontend (links de convite e origem padrão do CORS). */
    frontendUrl: (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, ""),

    /**
     * Origem permitida no CORS. Com login por cookie a origem precisa ser
     * explícita (o navegador recusa "qualquer origem" com credenciais);
     * vazio = usa `frontendUrl`.
     */
    corsOrigin: process.env.CORS_ORIGIN || "",

    auth: {
        /** Segredo que assina os tokens de sessão (mín. 32 caracteres). */
        segredo: process.env.AUTH_SEGREDO,
        nomeCookie: "igm_sessao",
        /** Sessão comum: expira em 8 horas. */
        duracaoPadraoMs: 8 * 60 * 60 * 1000,
        /** "Manter conectado": 30 dias. */
        duracaoLongaMs: 30 * 24 * 60 * 60 * 1000,
        /** Limite de tentativas de login erradas por IP + e-mail. */
        tentativasMaximas: 5,
        janelaTentativasMs: 15 * 60 * 1000
    },

    supabase: {
        url: process.env.SUPABASE_URL,
        chaveServico: process.env.SUPABASE_SERVICE_ROLE_KEY
    },

    diretorios: {
        storage: DIRETORIO_STORAGE,
        uploads: path.join(DIRETORIO_STORAGE, "uploads"),
        logs: path.join(DIRETORIO_STORAGE, "logs")
    },

    /**
     * Se o cliente pode conectar o próprio perfil em "Meus perfis".
     * O Chromium abre na máquina do BACKEND: funciona com tudo no mesmo
     * computador; num servidor (EC2) desligue com CONEXAO_PELO_CLIENTE=false
     * até existir o navegador remoto. Padrão: ligado.
     */
    conexaoPeloCliente: process.env.CONEXAO_PELO_CLIENTE !== "false",

    /**
     * Se o botão "Conectar" abre o Chromium NESTA máquina para o login no
     * Instagram. Só faz sentido onde há uma tela (o computador de quem
     * usa). Num servidor sem tela (Oracle, EC2) use CONEXAO_NO_SERVIDOR=false:
     * a conexão passa a ser feita enviando o arquivo de sessão gerado no
     * computador (`npm run login:instagram`). Padrão: ligado.
     */
    conexaoNoServidor: process.env.CONEXAO_NO_SERVIDOR !== "false",

    /** Arquivo de sessão enviado pelo site (Clientes → Enviar sessão). */
    sessaoImportada: {
        tamanhoMaximoBytes: 1024 * 1024
    },

    upload: {
        // A Vercel recusa requisições acima de 4,5 MB (o site reduz as
        // imagens grandes antes de enviar).
        tamanhoMaximoBytes: (modo === MODOS.API ? 4 : 15) * 1024 * 1024,
        tiposPermitidos: ["image/jpeg", "image/png", "image/webp"]
    }
};

/**
 * Garante que as variáveis de ambiente informadas estejam definidas.
 * Deve ser chamada apenas por quem realmente precisa delas, para que
 * scripts simples não exijam credenciais que não usam.
 *
 * @param {string[]} nomes - Nomes das variáveis obrigatórias.
 * @throws {Error} Se alguma variável estiver ausente.
 */
function exigirVariaveis(nomes) {
    const ausentes = nomes.filter((nome) => !process.env[nome]);

    if (ausentes.length > 0) {
        throw new Error(
            `Variáveis ausentes no backend/.env: ${ausentes.join(", ")}`
        );
    }
}

module.exports = { config, exigirVariaveis, MODOS };
