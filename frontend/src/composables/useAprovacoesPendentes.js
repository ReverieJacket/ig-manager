/**
 * Aprovações pendentes do cliente: contador do menu "Aprovações".
 *
 * Estado único (fora da função) para o menu e a tela verem o mesmo valor.
 * A tela Aprovações atualiza o número com `definir` sempre que recarrega.
 */
import { ref } from "vue";

import { listarAprovacoes } from "../api/minhaArea";

const total = ref(0);
let ultimaBusca = 0;

/** Intervalo mínimo entre consultas automáticas (troca de tela). */
const INTERVALO_MS = 30 * 1000;

export function useAprovacoesPendentes() {
  /** Erros são silenciosos: o contador é um extra. */
  async function atualizar({ forcar = false } = {}) {
    if (!forcar && Date.now() - ultimaBusca < INTERVALO_MS) return;
    ultimaBusca = Date.now();

    try {
      total.value = (await listarAprovacoes()).pendentes.length;
    } catch {
      // Mantém o último valor conhecido.
    }
  }

  function definir(valor) {
    total.value = valor;
    ultimaBusca = Date.now();
  }

  return { totalPendentes: total, atualizar, definir };
}
