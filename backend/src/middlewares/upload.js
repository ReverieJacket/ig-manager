/**
 * Configuração do multer para receber a imagem da publicação.
 *
 * Guarda o arquivo em `storage/uploads` com um nome aleatório: o nome
 * original enviado pelo cliente nunca é usado, evitando colisões e
 * caminhos maliciosos.
 */
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { config } = require("../config/env");
const { ErroHttp } = require("../lib/erros");

fs.mkdirSync(config.diretorios.uploads, { recursive: true });

const armazenamento = multer.diskStorage({
    destination: (req, arquivo, callback) => {
        callback(null, config.diretorios.uploads);
    },

    filename: (req, arquivo, callback) => {
        const extensao = path.extname(arquivo.originalname).toLowerCase();
        const sufixo = Math.random().toString(36).slice(2, 10);

        callback(null, `${Date.now()}-${sufixo}${extensao}`);
    }
});

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

module.exports = { uploadImagem };
