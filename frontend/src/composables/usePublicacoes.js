/**
 * Composable da listagem de publicações: carregamento, filtro por
 * status e por cliente, busca por texto e contadores do resumo.
 */
import { computed, onMounted, ref } from "vue";

import { listarPublicacoes } from "../api/publicacoes";
import { APROVACAO, FILTRO_AGUARDANDO, FILTRO_TODAS, STATUS } from "../constants/publicacoes";
import { normalizarStatus } from "../utils/formatadores";

/**
 * @returns Estado reativo da listagem:
 *   - `carregando`, `erro`: estado da requisição;
 *   - `filtro`, `busca`, `cliente`: controles editados pela tela
 *     (`cliente` = id do cliente em texto, ou "" para todos);
 *   - `clientes`: clientes presentes nas publicações, com a quantidade;
 *   - `filtradas`: publicações após filtro e busca;
 *   - `contagens`: quantidade por status (ex.: `contagens.value.publicada`).
 */
export function usePublicacoes() {
  const publicacoes = ref([]);
  const carregando = ref(true);
  const erro = ref("");
  const filtro = ref(FILTRO_TODAS);
  const busca = ref("");
  const cliente = ref("");

  /** Clientes que aparecem nas publicações, para o filtro. */
  const clientes = computed(() => {
    const mapa = new Map();
    for (const p of publicacoes.value) {
      if (p.cliente_id == null) continue;
      const atual = mapa.get(p.cliente_id) || { id: String(p.cliente_id), nome: p.cliente || "—", total: 0 };
      atual.total += 1;
      mapa.set(p.cliente_id, atual);
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  });

  /** Publicações do cliente escolhido (ou todas). Base dos contadores. */
  const doCliente = computed(() =>
    cliente.value
      ? publicacoes.value.filter((p) => String(p.cliente_id) === cliente.value)
      : publicacoes.value
  );

  /** Agendada esperando a resposta do cliente. */
  function aguardandoCliente(publicacao) {
    return (
      normalizarStatus(publicacao.status) === STATUS.AGENDADA &&
      publicacao.aprovacao === APROVACAO.PENDENTE
    );
  }

  /**
   * Quantidade de publicações por status (todos começam em 0), mais
   * `aguardando_cliente`.
   */
  const contagens = computed(() => {
    const total = Object.fromEntries(
      Object.values(STATUS).map((status) => [status, 0])
    );
    total[FILTRO_AGUARDANDO] = 0;

    for (const publicacao of doCliente.value) {
      const status = normalizarStatus(publicacao.status);

      if (status in total) total[status] += 1;
      if (aguardandoCliente(publicacao)) total[FILTRO_AGUARDANDO] += 1;
    }

    return total;
  });

  const filtradas = computed(() => {
    const termo = busca.value.trim().toLowerCase();

    return doCliente.value.filter((publicacao) => {
      if (filtro.value === FILTRO_AGUARDANDO) {
        if (!aguardandoCliente(publicacao)) return false;
      } else if (
        filtro.value !== FILTRO_TODAS &&
        normalizarStatus(publicacao.status) !== filtro.value
      ) {
        return false;
      }

      if (!termo) return true;

      return [publicacao.texto, publicacao.conta, publicacao.username, publicacao.cliente].some(
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

  return { carregando, erro, filtro, busca, cliente, clientes, filtradas, contagens, carregar };
}
