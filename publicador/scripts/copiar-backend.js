/**
 * Antes de gerar o instalador: copia o código do backend (backend/src) para
 * dentro do app, que roda sozinho no computador do administrador.
 *
 * O app usa só a parte do Publicador e da automação; nenhuma chave vai junto
 * (o .env não é copiado).
 */
const fs = require("fs");
const path = require("path");

const origem = path.join(__dirname, "..", "..", "backend", "src");
const destino = path.join(__dirname, "..", "backend", "src");

fs.rmSync(path.join(__dirname, "..", "backend"), { recursive: true, force: true });
fs.cpSync(origem, destino, { recursive: true });

console.log(`Backend copiado para ${destino}`);
