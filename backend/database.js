require("dotenv").config();

const { Pool } = require("pg");

const obrigatorias = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD"
];

const ausentes = obrigatorias.filter(
    (variavel) => !process.env[variavel]
);

if (ausentes.length > 0) {
    throw new Error(
        `Variáveis ausentes no .env: ${ausentes.join(", ")}`
    );
}

console.log("=== CONFIGURAÇÃO DO BANCO ===");
console.log("Host:", process.env.DB_HOST);
console.log("Porta:", process.env.DB_PORT);
console.log("Database:", process.env.DB_NAME);
console.log("User:", process.env.DB_USER);
console.log("Password definida:", !!process.env.DB_PASSWORD);
console.log("=============================");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on("error", (erro) => {
    console.error("❌ ERRO NO POOL:");
    console.error(erro.message);
});

async function testarConexao() {
    console.log("\n=== TESTANDO CONEXÃO ===");

    let cliente;

    try {
        console.log("1. Tentando conectar...");

        cliente = await pool.connect();

        console.log("2. Conexão estabelecida!");

        const resultado = await cliente.query(
            "SELECT NOW() AS horario, current_database() AS banco"
        );

        console.log("3. Consulta executada!");
        console.log("Horário do banco:", resultado.rows[0].horario);
        console.log("Banco conectado:", resultado.rows[0].banco);

        console.log("✅ CONEXÃO COM SUPABASE FUNCIONANDO!");

    } catch (erro) {
        console.error("\n❌ ERRO NA CONEXÃO:");
        console.error("Nome:", erro.name);
        console.error("Mensagem:", erro.message);
        console.error("Código:", erro.code);
    } finally {
        if (cliente) {
            cliente.release();
        }
    }
}

module.exports = {
    pool,
    testarConexao
};