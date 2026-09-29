const { supabase } = require("./supabase");

async function testarConexao() {
    console.log("Testando conexão com o Supabase...");

    const { data, error } = await supabase
        .from("contas_instagram")
        .select("*")
        .limit(1);

    if (error) {
        console.error("Erro ao consultar o Supabase:", error.message);
        return;
    }

    console.log("Conexão e consulta realizadas com sucesso!");
    console.log("Registros encontrados:", data.length);
}

testarConexao();