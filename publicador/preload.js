/**
 * Ponte segura entre a janela (HTML) e o processo principal: a janela só
 * enxerga estas funções, nunca o Node.js inteiro.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("publicador", {
    /** Login de administrador: `{ site, email, senha }`. */
    entrar: (dados) => ipcRenderer.invoke("login:entrar", dados),
    /** Recebe o que mostrar: `{ modo, itens, ... }`. */
    aoReceber: (callback) => ipcRenderer.on("dados", (_evento, dados) => callback(dados)),
    publicarAgora: (id) => ipcRenderer.invoke("atrasada:publicar", id),
    reagendar: (id, dataHora) => ipcRenderer.invoke("atrasada:reagendar", id, dataHora),
    publicarTodas: () => ipcRenderer.invoke("atrasadas:publicar-todas"),
    /** "sair" (fecha o Publicador mesmo assim) ou "ficar". */
    responderSaida: (escolha) => ipcRenderer.invoke("saida:responder", escolha),
    fechar: () => ipcRenderer.invoke("janela:fechar")
});
