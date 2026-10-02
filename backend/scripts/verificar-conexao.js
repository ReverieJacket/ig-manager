/**
 * Verifica se o backend consegue falar com o Supabase:
 * `npm run verificar:conexao -w backend`.
 *
 * Substitui `teste-banco.js` (conexão direta via `pg`) e
 * `teste-supabase.js`. Como a aplicação usa apenas o cliente supabase-js,
 * é ele que precisa ser testado; a dependência `pg` foi removida.
 */
const { supabase } = require("../src/lib/supabase");

async function verificarConexao() {
    console.log("Testando conexão com o Supabase...");

    const { data, error } = await supabase
        .from("contas_instagram")
        .select("id")
        .limit(1);

    if (error) {
        console.error("Erro ao consultar o Supabase:", error.message);
        process.exitCode = 1;
        return;
    }

    console.log("Conexão e consulta realizadas com sucesso!");
    console.log("Registros encontrados na amostra:", data.length);
}

verificarConexao();
