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
const DIRETORIO_STORAGE = path.join(RAIZ_BACKEND, "storage");

const emProducao = process.env.NODE_ENV === "production";

const config = {
    emProducao,

    porta: Number(process.env.PORT || 3000),

    log: {
        /** debug | info | warn | error | silent. Padrão: debug em desenvolvimento, info em produção. */
        nivel: process.env.LOG_LEVEL || (emProducao ? "info" : "debug"),
        /** Se "true", grava também em storage/logs/backend.log (formato JSON). */
        emArquivo: process.env.LOG_EM_ARQUIVO === "true"
    },

    /** Origem permitida no CORS. Vazio = qualquer origem (apenas para desenvolvimento). */
    corsOrigin: process.env.CORS_ORIGIN || "",

    supabase: {
        url: process.env.SUPABASE_URL,
        chaveServico: process.env.SUPABASE_SERVICE_ROLE_KEY
    },

    instagram: {
        /** Perfil aberto pela automação; deve corresponder à sessão salva. */
        usuario: process.env.INSTAGRAM_USERNAME,
        arquivoSessao: path.join(DIRETORIO_STORAGE, "instagram-auth.json")
    },

    diretorios: {
        storage: DIRETORIO_STORAGE,
        uploads: path.join(DIRETORIO_STORAGE, "uploads"),
        logs: path.join(DIRETORIO_STORAGE, "logs")
    },

    upload: {
        tamanhoMaximoBytes: 15 * 1024 * 1024,
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

module.exports = { config, exigirVariaveis };
