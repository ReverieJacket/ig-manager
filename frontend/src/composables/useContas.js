/**
 * Composable que carrega as contas ativas do Instagram.
 */
import { onMounted, ref } from "vue";

import { listarContas } from "../api/contas";

/**
 * @returns {{contas: import("vue").Ref<Array>,
 *            carregando: import("vue").Ref<boolean>,
 *            erro: import("vue").Ref<string>,
 *            carregar: () => Promise<void>}}
 *   Estado reativo e a função `carregar` (chamada automaticamente ao montar).
 */
export function useContas() {
  const contas = ref([]);
  const carregando = ref(false);
  const erro = ref("");

  async function carregar() {
    carregando.value = true;
    erro.value = "";

    try {
      contas.value = await listarContas();
    } catch (e) {
      console.error("Erro ao carregar contas:", e);
      erro.value = e.message || "Erro ao carregar as contas do Instagram.";
    } finally {
      carregando.value = false;
    }
  }

  onMounted(carregar);

  return { contas, carregando, erro, carregar };
}
