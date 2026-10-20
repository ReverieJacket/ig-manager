/**
 * Estado da sessão (usuário logado), compartilhado por todo o app.
 *
 * O estado fica fora da função para ser único: todas as telas que chamam
 * `useSessao()` enxergam o mesmo usuário.
 */
import { computed, ref } from "vue";

import * as authApi from "../api/auth";

export const PERFIS = Object.freeze({ ADMIN: "admin", CLIENTE: "cliente" });

const usuario = ref(null);
let carregamento = null;

/** Tela inicial de cada perfil. */
export function rotaInicial(perfil) {
  return perfil === PERFIS.CLIENTE ? { name: "cliente-inicio" } : { name: "postagens" };
}

export function useSessao() {
  /**
   * Descobre se já existe sessão (cookie). Só consulta a API uma vez;
   * chamadas seguintes reaproveitam o resultado.
   */
  function carregar() {
    if (!carregamento) {
      carregamento = authApi
        .buscarUsuarioAtual()
        .then((dados) => {
          usuario.value = dados;
          return dados;
        })
        .catch((erro) => {
          // Falha de rede: permite tentar de novo na próxima navegação.
          carregamento = null;
          throw erro;
        });
    }
    return carregamento;
  }

  async function entrar(dados) {
    usuario.value = await authApi.entrar(dados);
    carregamento = Promise.resolve(usuario.value);
    return usuario.value;
  }

  async function sair() {
    try {
      await authApi.sair();
    } finally {
      limpar();
    }
  }

  /** Esquece a sessão local (ex.: o backend respondeu 401). */
  function limpar() {
    usuario.value = null;
    carregamento = Promise.resolve(null);
  }

  return {
    usuario,
    ehAdmin: computed(() => usuario.value?.perfil === PERFIS.ADMIN),
    ehCliente: computed(() => usuario.value?.perfil === PERFIS.CLIENTE),
    carregar,
    entrar,
    sair,
    limpar,
  };
}
