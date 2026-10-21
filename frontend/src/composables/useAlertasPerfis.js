/**
 * Perfis com sessão expirada, compartilhados pelo app do administrador:
 * contador no menu "Clientes" e aviso no topo de Postagens.
 *
 * Estado único (fora da função) para todas as telas verem o mesmo valor.
 */
import { computed, ref } from "vue";

import { listarPerfisEmAtencao } from "../api/perfis";

const perfis = ref([]);
let ultimaBusca = 0;

/** Intervalo mínimo entre consultas automáticas (troca de tela). */
const INTERVALO_MS = 30 * 1000;

export function useAlertasPerfis() {
  /**
   * Atualiza a lista. Sem `forcar`, ignora chamadas muito próximas.
   * Erros são silenciosos: o aviso é um extra, não bloqueia a tela.
   */
  async function atualizar({ forcar = false } = {}) {
    if (!forcar && Date.now() - ultimaBusca < INTERVALO_MS) return;
    ultimaBusca = Date.now();

    try {
      perfis.value = await listarPerfisEmAtencao();
    } catch {
      // Mantém o último valor conhecido.
    }
  }

  return {
    perfisEmAtencao: perfis,
    totalEmAtencao: computed(() => perfis.value.length),
    atualizar,
  };
}
