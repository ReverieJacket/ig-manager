/**
 * Configuração do multer para receber a imagem da publicação.
 *
 * Guarda o arquivo com um nome aleatório (o nome original enviado pelo
 * cliente nunca é usado, evitando colisões e caminhos maliciosos): em
 * `storage/uploads` ou, na Vercel, na memória até ir para o Supabase
 * Storage (`lib/imagens`).
 */
const fs = require("fs");
const multer = require("multer");

const { espacoAtual, noContexto } = require("../lib/espaco");

const { config } = require("../config/env");
const { ErroHttp } = require("../lib/erros");
const { gerarNome } = require("../lib/imagens");

/**
 * Disco (storage/uploads) no computador; memória quando a imagem vai para
 * o Supabase Storage (na Vercel não há disco para gravar).
 */
function criarArmazenamento() {
    if (config.imagensNoSupabase) return multer.memoryStorage();

    fs.mkdirSync(config.diretorios.uploads, { recursive: true });

    return multer.diskStorage({
        destination: (req, arquivo, callback) => {
            callback(null, config.diretorios.uploads);
        },

        filename: (req, arquivo, callback) => {
            callback(null, gerarNome(arquivo.originalname));
        }
    });
}

const armazenamento = criarArmazenamento();

/** Middleware que aceita um único arquivo no campo `imagem`. */
const uploadImagem = multer({
    storage: armazenamento,
    limits: { fileSize: config.upload.tamanhoMaximoBytes },
    fileFilter: (req, arquivo, callback) => {
        if (!config.upload.tiposPermitidos.includes(arquivo.mimetype)) {
            return callback(
                new ErroHttp(400, "Envie uma imagem JPG, PNG ou WEBP.")
            );
        }

        callback(null, true);
    }
}).single("imagem");

/**
 * Arquivo de sessão do Instagram (campo `arquivo`), mantido só na memória:
 * é conferido e gravado pelo `sessao-importada.service`, nunca em uploads/.
 */
const uploadSessao = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.sessaoImportada.tamanhoMaximoBytes, files: 1 }
}).single("arquivo");

/**
 * O multer chama o `next` a partir dos eventos do envio, fora do contexto da
 * requisição: devolve o espaço atual (lib/espaco) antes de seguir.
 */
function manterEspaco(middleware) {
    return function receber(req, res, next) {
        const espacoId = espacoAtual();
        middleware(req, res, (erro) =>
            espacoId === null ? next(erro) : noContexto(espacoId, () => next(erro))
        );
    };
}

module.exports = {
    uploadImagem: manterEspaco(uploadImagem),
    uploadSessao: manterEspaco(uploadSessao)
};
