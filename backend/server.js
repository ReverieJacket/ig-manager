const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const { publicarNoInstagram } = require("./instagram");

const app = express();

const upload = multer({
    dest: "uploads/"
});

app.use(express.json());
app.use(cors());


/*
|--------------------------------------------------------------------------
| Rota de teste
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
    res.json({
        mensagem: "Backend do IG Manager funcionando!"
    });
});


/*
|--------------------------------------------------------------------------
| Criar publicação
|--------------------------------------------------------------------------
*/

app.post("/publicacoes", upload.single("imagem"), async (req, res) => {

    try {

        const { texto, dataHora } = req.body;
        const imagem = req.file;

        console.log("\n=================================");
        console.log("NOVA PUBLICAÇÃO");
        console.log("=================================");

        console.log("Texto:", texto);
        console.log("Data e hora:", dataHora);
        console.log("Imagem:", imagem?.path);


        /*
        |--------------------------------------------------------------------------
        | Validações
        |--------------------------------------------------------------------------
        */

        if (!imagem) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Nenhuma imagem foi enviada."
            });
        }

        if (!texto || !texto.trim()) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "A legenda não foi informada."
            });
        }

        if (!dataHora) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "A data e hora não foram informadas."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | Converte a data recebida
        |--------------------------------------------------------------------------
        */

        const dataPublicacao = new Date(dataHora);

        if (isNaN(dataPublicacao.getTime())) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Data e hora inválidas."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | Caminho da imagem
        |--------------------------------------------------------------------------
        */

        const caminhoImagem = path.resolve(imagem.path);


        /*
        |--------------------------------------------------------------------------
        | Calcula quanto falta para a publicação
        |--------------------------------------------------------------------------
        */

        const agora = new Date();

        const diferenca =
            dataPublicacao.getTime() -
            agora.getTime();


        console.log("Agora:", agora);
        console.log("Publicação:", dataPublicacao);
        console.log("Diferença:", diferenca, "ms");


        /*
        |--------------------------------------------------------------------------
        | PUBLICAÇÃO IMEDIATA
        |--------------------------------------------------------------------------
        */

        if (diferenca <= 0) {

            console.log("Publicação para agora.");
            console.log("Iniciando Playwright...");


            const resultado =
                await publicarNoInstagram(
                    caminhoImagem,
                    texto,
                    imagem.mimetype
                );


            if (!resultado.sucesso) {

                return res.status(500).json(resultado);

            }


            return res.json({

                sucesso: true,

                mensagem:
                    "Publicação realizada com sucesso!"

            });

        }


        /*
        |--------------------------------------------------------------------------
        | PUBLICAÇÃO AGENDADA
        |--------------------------------------------------------------------------
        */

        console.log(
            `Publicação agendada para ${dataPublicacao.toLocaleString()}`
        );


        setTimeout(async () => {

            console.log("\n=================================");
            console.log("EXECUTANDO PUBLICAÇÃO AGENDADA");
            console.log("=================================");


            try {

                const resultado =
                    await publicarNoInstagram(
                        caminhoImagem,
                        texto,
                        imagem.mimetype
                    );


                if (resultado.sucesso) {

                    console.log(
                        "Publicação agendada realizada com sucesso!"
                    );

                } else {

                    console.error(
                        "Erro na publicação agendada:"
                    );

                    console.error(
                        resultado
                    );

                }

            } catch (erro) {

                console.error(
                    "Erro ao executar publicação agendada:"
                );

                console.error(erro);

            }

        }, diferenca);


        /*
        |--------------------------------------------------------------------------
        | Resposta para o frontend
        |--------------------------------------------------------------------------
        */

        return res.json({

            sucesso: true,

            mensagem:
                `Publicação agendada para ${dataPublicacao.toLocaleString()}.`

        });


    } catch (erro) {

        console.error(
            "\nErro no processamento da publicação:"
        );

        console.error(erro);


        res.status(500).json({

            sucesso: false,

            mensagem:
                "Erro ao processar a publicação.",

            erro: erro.message

        });

    }

});


/*
|--------------------------------------------------------------------------
| Inicia servidor
|--------------------------------------------------------------------------
*/

app.listen(3000, () => {

    console.log(
        "Servidor rodando em http://localhost:3000"
    );

});