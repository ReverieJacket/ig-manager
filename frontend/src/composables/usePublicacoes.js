/**
 * Composable da listagem de publicações: carregamento, filtro por
 * status, busca por texto e contadores do resumo.
 */
import { computed, onMounted, ref } from "vue";

import { listarPublicacoes } from "../api/publicacoes";
import { FILTRO_TODAS, STATUS } from "../constants/publicacoes";
import { normalizarStatus } from "../utils/formatadores";

/**
 * @returns Estado reativo da listagem:
 *   - `carregando`, `erro`: estado da requisição;
 *   - `filtro`, `busca`: controles editados pela tela;
 *   - `filtradas`: publicações após filtro e busca;
 *   - `contagens`: quantidade por status (ex.: `contagens.value.publicada`).
 */
export function usePublicacoes() {
  const publicacoes = ref([]);
  const carregando = ref(true);
  const erro = ref("");
  const filtro = ref(FILTRO_TODAS);
  const busca = ref("");

  /** Quantidade de publicações por status; todos os status começam em 0. */
  const contagens = computed(() => {
    const total = Object.fromEntries(
      Object.values(STATUS).map((status) => [status, 0])
    );

    for (const publicacao of publicacoes.value) {
      const status = normalizarStatus(publicacao.status);

      if (status in total) total[status] += 1;
    }

    return total;
  });

  const filtradas = computed(() => {
    const termo = busca.value.trim().toLowerCase();

    return publicacoes.value.filter((publicacao) => {
      if (
        filtro.value !== FILTRO_TODAS &&
        normalizarStatus(publicacao.status) !== filtro.value
      ) {
        return false;
      }

      if (!termo) return true;

      return [publicacao.texto, publicacao.conta, publicacao.username].some(
        (campo) => String(campo || "").toLowerCase().includes(termo)
      );
    });
  });

  /**
   * Busca as publicações. Com `silencioso`, atualiza os dados sem mostrar
   * o estado "carregando" (evita a tabela piscar ao atualizar contadores).
   */
  async function carregar({ silencioso = false } = {}) {
    if (!silencioso) carregando.value = true;
    erro.value = "";

    try {
      publicacoes.value = await listarPublicacoes();
    } catch (e) {
      console.error("Erro ao carregar publicações:", e);
      erro.value =
        "Não foi possível carregar as publicações. Verifique se o backend está funcionando.";
    } finally {
      carregando.value = false;
    }
  }

  onMounted(carregar);

  return { carregando, erro, filtro, busca, filtradas, contagens, carregar };
}
