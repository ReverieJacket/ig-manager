/**
 * Imagens das postagens: no disco (storage/uploads) ou no Supabase Storage
 * (bucket `publicacoes`, migração 011), conforme `config.imagensNoSupabase`.
 *
 * O banco guarda só o NOME do arquivo (coluna `imagem`); este módulo sabe
 * onde ele está:
 * - o site (Vercel) grava no Storage e mostra por um link temporário;
 * - o Publicador usa o arquivo do disco se existir; se não, baixa do
 *   Storage para storage/uploads (e reaproveita nas próximas vezes).
 */
const fs = require("fs");
const path = require("path");

const { config } = require("../config/env");

/** Nome aleatório (o nome enviado pelo usuário nunca é usado). */
function gerarNome(nomeOriginal) {
    const extensao = path.extname(String(nomeOriginal || "")).toLowerCase().replace(/[^.a-z0-9]/g, "");
    const sufixo = Math.random().toString(36).slice(2, 10);
    return `${Date.now()}-${sufixo}${extensao}`;
}

/** `path.basename` impede que um valor adulterado aponte para fora da pasta. */
function nomeSeguro(nome) {
    return path.basename(String(nome || ""));
}

function bucket() {
    const { supabase } = require("./supabase");
    return supabase.storage.from(config.bucketImagens);
}

/**
 * Grava a imagem recebida pelo multer e devolve o nome a guardar no banco.
 * No modo disco o multer já gravou o arquivo; no Storage, envia o buffer.
 *
 * @param {Express.Multer.File} arquivo
 * @returns {Promise<string>}
 */
async function guardarEnviada(arquivo) {
    if (!config.imagensNoSupabase) return arquivo.filename;

    const nome = gerarNome(arquivo.originalname);
    const { error } = await bucket().upload(nome, arquivo.buffer, {
        contentType: arquivo.mimetype,
        upsert: false
    });

    if (error) {
        throw new Error(
            `Não foi possível guardar a imagem no Supabase Storage (${error.message}). ` +
            "Confira se a migração 011 foi executada."
        );
    }

    return nome;
}

/**
 * Link temporário (1 hora) para exibir a imagem guardada no Storage.
 *
 * @param {string} nome
 * @returns {Promise<string|null>}
 */
async function linkTemporario(nome) {
    const { data, error } = await bucket().createSignedUrl(nomeSeguro(nome), 60 * 60);
    if (error) return null;
    return data.signedUrl;
}

/**
 * Caminho no disco para a automação usar. Baixa do Storage se o arquivo
 * ainda não estiver neste computador.
 *
 * @param {string} nome
 * @returns {Promise<string>}
 * @throws {Error} Se a imagem não existir em lugar nenhum.
 */
async function caminhoLocal(nome) {
    const arquivo = path.resolve(config.diretorios.uploads, nomeSeguro(nome));

    if (fs.existsSync(arquivo)) return arquivo;

    let baixada;
    try {
        const { data, error } = await bucket().download(nomeSeguro(nome));
        if (error) throw error;
        baixada = Buffer.from(await data.arrayBuffer());
    } catch (erro) {
        throw new Error(`Imagem não encontrada (${nomeSeguro(nome)}): ${erro.message || erro}`);
    }

    fs.mkdirSync(config.diretorios.uploads, { recursive: true });
    fs.writeFileSync(arquivo, baixada);

    return arquivo;
}

/**
 * Envia ao Storage as imagens que só existem neste computador (postagens
 * criadas antes do site ir para a Vercel), para as miniaturas aparecerem
 * no site. Lembra o que já enviou em storage/imagens-no-storage.json.
 *
 * @param {string[]} nomes - Valores da coluna `imagem`.
 * @returns {Promise<number>} Quantas foram enviadas agora.
 */
async function enviarLocaisAoStorage(nomes) {
    const registro = path.join(config.diretorios.storage, "imagens-no-storage.json");
    let enviadas = [];
    try {
        enviadas = JSON.parse(fs.readFileSync(registro, "utf8"));
    } catch {
        enviadas = [];
    }
    const jaEnviadas = new Set(enviadas);
    let novas = 0;

    for (const nome of new Set(nomes.filter(Boolean).map(nomeSeguro))) {
        if (jaEnviadas.has(nome)) continue;

        const arquivo = path.join(config.diretorios.uploads, nome);
        if (!fs.existsSync(arquivo)) continue;

        const extensao = path.extname(nome).toLowerCase();
        const tipo = extensao === ".png" ? "image/png" : extensao === ".webp" ? "image/webp" : "image/jpeg";
        const { error } = await bucket().upload(nome, fs.readFileSync(arquivo), { contentType: tipo, upsert: false });

        // "já existe" também conta como enviada.
        if (error && !/exists|duplicate/i.test(error.message || "")) throw error;

        jaEnviadas.add(nome);
        novas++;
    }

    fs.mkdirSync(path.dirname(registro), { recursive: true });
    fs.writeFileSync(registro, JSON.stringify([...jaEnviadas]));

    return novas;
}

module.exports = { gerarNome, guardarEnviada, linkTemporario, caminhoLocal, enviarLocaisAoStorage };
