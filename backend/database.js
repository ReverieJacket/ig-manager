const { Pool } = require("pg");
require("dotenv").config();

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
    console.error(erro);
});

async function testarConexao() {
    console.log("\n=== TESTANDO CONEXÃO ===");

    try {
        console.log("1. Tentando conectar...");
        
        const cliente = await pool.connect();

        console.log("2. Conexão TCP estabelecida!");

        const resultado = await cliente.query("SELECT NOW()");

        console.log("3. Query executada!");
        console.log("Horário do banco:", resultado.rows[0].now);

        cliente.release();

        console.log("✅ CONEXÃO COM POSTGRESQL FUNCIONANDO!");

    } catch (erro) {
        console.error("\n❌ ERRO DETALHADO:");
        console.error("Nome:", erro.name);
        console.error("Mensagem:", erro.message);
        console.error("Código:", erro.code);
        console.error("Errno:", erro.errno);
        console.error("Hostname:", erro.hostname);
        console.error("Stack:");
        console.error(erro.stack);
    }
}

module.exports = {
    pool,
    testarConexao
};