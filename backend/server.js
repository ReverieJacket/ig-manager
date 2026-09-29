
// backend/server.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const { publicarNoInstagram } = require("./instagram");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
        "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env."
    );
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    }
);

const UPLOAD_DIR = path.resolve(__dirname, "uploads");
const LOG_DIR = path.resolve(__dirname, "logs");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disponibiliza as imagens locais ao frontend.
// Em produção, prefira armazenamento persistente, como Supabase Storage.
app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
        dotfiles: "deny",
        index: false
    })
);

// Upload de imagens.
const armazenamento = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, UPLOAD_DIR);
    },
    filename: (req, file, callback) => {
        const extensao = path.extname(file.originalname).toLowerCase();
        const nomeSeguro = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}${extensao}`;

        callback(null, nomeSeguro);
    }
});

const upload = multer({
    storage: armazenamento,
    limits: {
        fileSize: 15 * 1024 * 1024
    },
    fileFilter: (req, file, callback) => {
        const permitidos = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!permitidos.includes(file.mimetype)) {
            return callback(
                new Error("Envie uma imagem JPG, PNG ou WEBP.")
            );
        }

        callback(null, true);
    }
});

// Temporizadores de agendamento mantidos em memória.
const agendamentos = new Map();

function log(mensagem, dados = "") {
    console.log(
        `[Backend][${new Date().toISOString()}] ${mensagem}`,
        dados
    );
}

function formatarErro(erro) {
    if (!erro) return "Erro não especificado.";

    return erro.message || String(erro);
}

function removerAgendamento(id) {
    const timer = agendamentos.get(id);

    if (timer) {
        clearTimeout(timer);
        agendamentos.delete(id);
    }
}

async function atualizarPublicacao(id, campos) {
    const { data, error } = await supabase
        .from("publicacoes")
        .update(campos)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        log(`Erro ao atualizar publicação ${id}`, error.message);
        throw error;
    }

    return data;
}

// Executa uma publicação já registrada no banco.
async function executarPublicacao(publicacao) {
    const id = publicacao.id;

    removerAgendamento(id);

    log(`Iniciando publicação ${id}`);

    try {
        await atualizarPublicacao(id, {
            status: "publicando",
            erro: null
        });

        const caminhoImagem = path.resolve(
            UPLOAD_DIR,
            path.basename(publicacao.imagem)
        );

        if (!fs.existsSync(caminhoImagem)) {
            throw new Error(
                `Imagem não encontrada no servidor: ${caminhoImagem}`
            );
        }

        // Obtém a conta associada à publicação.
        const { data: conta, error: erroConta } = await supabase
            .from("contas_instagram")
            .select("id, nome, username, ativo")
            .eq("id", publicacao.conta_id)
            .maybeSingle();

        if (erroConta) throw erroConta;

        if (!conta || !conta.ativo) {
            throw new Error(
                "A conta vinculada não existe ou está inativa."
            );
        }

        log(`Conta selecionada para publicação ${id}`, {
            id: conta.id,
            username: conta.username
        });

        // A automação usa a sessão existente em auth.json.
        // Ela não troca automaticamente de sessão com base no username.
        const resultado = await publicarNoInstagram(
            caminhoImagem,
            publicacao.texto,
            publicacao.mimetype || undefined
        );

        log(`Resultado da automação da publicação ${id}`, resultado);

        if (resultado.sucesso) {
            await atualizarPublicacao(id, {
                status: "publicada",
                erro: null
            });

            log(`Publicação ${id} concluída.`);
            return {
                sucesso: true,
                id
            };
        }

        const mensagemErro = resultado.resultadoIncerto
            ? `Resultado incerto: ${resultado.mensagem}`
            : resultado.mensagem;

        await atualizarPublicacao(id, {
            status: "erro",
            erro: mensagemErro
        });

        log(`Falha na publicação ${id}`, {
            etapa: resultado.etapa,
            resultadoIncerto: resultado.resultadoIncerto,
            mensagem: resultado.mensagem,
            diagnostico: resultado.diagnostico
        });

        return {
            sucesso: false,
            id,
            resultadoIncerto: Boolean(resultado.resultadoIncerto),
            mensagem: mensagemErro
        };

    } catch (erro) {
        const mensagem = formatarErro(erro);

        log(`Erro ao executar publicação ${id}`, {
            mensagem
        });

        try {
            await atualizarPublicacao(id, {
                status: "erro",
                erro: mensagem
            });
        } catch (erroBanco) {
            log(
                `Não foi possível atualizar o status da publicação ${id}`,
                formatarErro(erroBanco)
            );
        }

        return {
            sucesso: false,
            id,
            mensagem
        };
    }
}

// Agenda a execução da publicação em memória.
function agendarPublicacao(publicacao) {
    const id = publicacao.id;
    const dataPublicacao = new Date(publicacao.data_hora);
    const diferenca = dataPublicacao.getTime() - Date.now();

    if (!Number.isFinite(diferenca) || diferenca <= 0) {
        return executarPublicacao(publicacao);
    }

    // setTimeout do Node.js suporta até 2^31 - 1 ms.
    const limiteTimer = 2147483647;

    if (diferenca > limiteTimer) {
        log(
            `Agendamento ${id} está muito distante para um único temporizador.`
        );

        const timer = setTimeout(() => {
            agendamentos.delete(id);
            agendarPublicacao(publicacao).catch((erro) => {
                log(`Erro ao reagendar publicação ${id}`, erro.message);
            });
        }, limiteTimer);

        agendamentos.set(id, timer);

        return Promise.resolve({
            sucesso: true,
            agendada: true,
            id
        });
    }

    const timer = setTimeout(() => {
        agendamentos.delete(id);

        executarPublicacao(publicacao).catch((erro) => {
            log(`Erro inesperado no agendamento ${id}`, erro.message);
        });
    }, diferenca);

    agendamentos.set(id, timer);

    log(`Publicação ${id} agendada`, {
        data: dataPublicacao.toISOString(),
        milissegundos: diferenca
    });

    return Promise.resolve({
        sucesso: true,
        agendada: true,
        id
    });
}

// Rota inicial.
app.get("/", (req, res) => {
    res.json({
        mensagem: "Backend do IG Manager funcionando!",
        status: "online"
    });
});

// Lista contas ativas.
app.get("/contas", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("contas_instagram")
            .select("id, nome, username, ativo")
            .eq("ativo", true)
            .order("id", { ascending: true });

        if (error) throw error;

        res.json(data || []);
    } catch (erro) {
        log("Erro ao consultar contas", formatarErro(erro));

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar contas."
        });
    }
});

// Lista publicações e associa os dados da conta.
app.get("/publicacoes", async (req, res) => {
    try {
        const { data: publicacoes, error: erroPublicacoes } =
            await supabase
                .from("publicacoes")
                .select(
                    "id, conta_id, imagem, texto, data_hora, status, erro"
                )
                .order("data_hora", { ascending: false });

        if (erroPublicacoes) throw erroPublicacoes;

        if (!publicacoes || publicacoes.length === 0) {
            return res.json([]);
        }

        const idsContas = [
            ...new Set(publicacoes.map((p) => p.conta_id))
        ];

        const { data: contas, error: erroContas } = await supabase
            .from("contas_instagram")
            .select("id, nome, username")
            .in("id", idsContas);

        if (erroContas) throw erroContas;

        const mapaContas = new Map(
            (contas || []).map((conta) => [conta.id, conta])
        );

        const resultado = publicacoes.map((publicacao) => {
            const conta = mapaContas.get(publicacao.conta_id);

            return {
                ...publicacao,
                conta: conta?.nome || "",
                username: conta?.username || "",
                imagem: publicacao.imagem
                    ? `/uploads/${encodeURIComponent(
                          path.basename(publicacao.imagem)
                      )}`
                    : null
            };
        });

        res.json(resultado);
    } catch (erro) {
        log("Erro ao consultar publicações", formatarErro(erro));

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar publicações."
        });
    }
});

// Cria uma publicação imediata ou agendada.
app.post(
    "/publicacoes",
    upload.single("imagem"),
    async (req, res) => {
        let arquivoRecebido = req.file;

        try {
            const texto = String(req.body.texto || "").trim();
            const dataHora = req.body.dataHora;
            const contaId = Number(
                req.body.contaId || req.body.conta_id
            );

            if (!arquivoRecebido) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "Nenhuma imagem foi enviada."
                });
            }

            if (!texto) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "A legenda não foi informada."
                });
            }

            if (!Number.isInteger(contaId) || contaId <= 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "Selecione uma conta do Instagram válida."
                });
            }

            if (!dataHora) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "Informe a data e hora da publicação."
                });
            }

            const dataPublicacao = new Date(dataHora);

            if (Number.isNaN(dataPublicacao.getTime())) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "Data e hora inválidas."
                });
            }

            const { data: conta, error: erroConta } = await supabase
                .from("contas_instagram")
                .select("id, nome, username, ativo")
                .eq("id", contaId)
                .maybeSingle();

            if (erroConta) throw erroConta;

            if (!conta || !conta.ativo) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "A conta selecionada não existe ou está inativa."
                });
            }

            const agora = new Date();
            const agendada = dataPublicacao.getTime() > agora.getTime();

            const registro = {
                conta_id: contaId,
                imagem: arquivoRecebido.filename,
                texto,
                data_hora: dataPublicacao.toISOString(),
                status: agendada ? "agendada" : "publicando",
                erro: null
            };

            log("Registrando nova publicação", {
                contaId,
                username: conta.username,
                dataHora: registro.data_hora,
                agendada
            });

            const { data: publicacao, error: erroInsert } =
                await supabase
                    .from("publicacoes")
                    .insert(registro)
                    .select()
                    .single();

            if (erroInsert) throw erroInsert;

            log(`Publicação registrada: ${publicacao.id}`);

            if (agendada) {
                await agendarPublicacao(publicacao);

                return res.status(201).json({
                    sucesso: true,
                    agendada: true,
                    id: publicacao.id,
                    mensagem:
                        `Publicação agendada para ${dataPublicacao.toLocaleString("pt-BR")}.`
                });
            }

            const resultado = await executarPublicacao(publicacao);

            if (resultado.sucesso) {
                return res.status(200).json({
                    sucesso: true,
                    id: publicacao.id,
                    mensagem: "Publicação realizada com sucesso."
                });
            }

            return res.status(502).json({
                sucesso: false,
                id: publicacao.id,
                resultadoIncerto: Boolean(resultado.resultadoIncerto),
                mensagem: resultado.mensagem ||
                    "A automação não confirmou a publicação."
            });

        } catch (erro) {
            log("Erro ao processar POST /publicacoes", {
                mensagem: formatarErro(erro)
            });

            // Remove o arquivo somente se não houve registro no banco.
            // Se a publicação já foi inserida, preserva a imagem para diagnóstico.
            res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao processar a publicação.",
                erro: formatarErro(erro)
            });
        }
    }
);

// Consulta um registro específico.
app.get("/publicacoes/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "ID de publicação inválido."
            });
        }

        const { data, error } = await supabase
            .from("publicacoes")
            .select("id, conta_id, imagem, texto, data_hora, status, erro")
            .eq("id", id)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Publicação não encontrada."
            });
        }

        res.json(data);
    } catch (erro) {
        log("Erro ao consultar publicação", formatarErro(erro));

        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao consultar a publicação."
        });
    }
});

// Tratamento de erros de upload e erros não tratados nas rotas.
app.use((erro, req, res, next) => {
    log("Erro HTTP", formatarErro(erro));

    if (res.headersSent) {
        return next(erro);
    }

    const status = erro instanceof multer.MulterError ? 400 : 500;

    res.status(status).json({
        sucesso: false,
        mensagem: erro.message || "Erro interno do servidor."
    });
});

app.listen(PORT, () => {
    log(`Servidor rodando em http://localhost:${PORT}`);
});