/**
 * Pool de conexões PostgreSQL compartilhado.
 *
 * Substitui o antigo cliente Supabase. Usa o módulo `pg` (node-postgres)
 * para se conectar diretamente ao RDS (ou qualquer PostgreSQL).
 *
 * Variáveis obrigatórias: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
 */
const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");

const { config, exigirVariaveis } = require("../config/env");

exigirVariaveis(["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]);

const poolConfig = {
    host: config.db.host,
    port: config.db.port,
    database: config.db.nome,
    user: config.db.usuario,
    password: config.db.senha,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
};

// Em produção, usa SSL com o certificado RDS (global-bundle.pem).
if (config.emProducao) {
    const certPath = path.resolve(__dirname, "../../global-bundle.pem");
    if (fs.existsSync(certPath)) {
        poolConfig.ssl = {
            rejectUnauthorized: true,
            ca: fs.readFileSync(certPath, "utf-8")
        };
    } else {
        // Fallback: SSL sem verificação de CA (não recomendado).
        poolConfig.ssl = { rejectUnauthorized: false };
    }
}

/** Instância única do pool (reaproveitada por todos os repositórios). */
const pool = new Pool(poolConfig);

// Log de erros inesperados no pool (conexões ociosas que morrem).
pool.on("error", (err) => {
    console.error("Erro inesperado no pool PostgreSQL:", err.message);
});

module.exports = { pool };
