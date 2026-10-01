/**
 * Composable dos comentários de UMA publicação: carrega a lista
 * (paginada), permite "carregar mais" e pedir uma nova coleta.
 */
import { computed, ref, watch } from "vue";

import { coletarComentarios, listarComentarios } from "../api/comentarios";
import { formatarCurtidas } from "../utils/formatadores";

const POR_PAGINA = 30;

/**
 * @param {import("vue").Ref<number|null>} publicacaoId - Publicação
 *   exibida; ao mudar, a lista é reiniciada. `null` = nada a mostrar.
 * @returns Estado reativo e ações:
 *   - `itens`, `total`, `atualizadoEm`: dados da lista;
 *   - `curtidasColetadas`: curtidas lidas na última coleta (ou `null`);
 *   - `carregando`, `erro`: estado do carregamento;
 *   - `temMais`: há mais páginas a buscar;
 *   - `incluirRemovidos`: filtro editado pela tela;
 *   - `coletando`, `resumoColeta`: estado/resultado do "Atualizar agora";
 *   - `carregarMais()`, `coletar()`.
 */
export function useComentarios(publicacaoId) {
  const itens = ref([]);
  const total = ref(0);
  const pagina = ref(1);
  const atualizadoEm = ref(null);
  const carregando = ref(false);
  const erro = ref("");
  const incluirRemovidos = ref(false);

  /** Curtidas lidas na última coleta desta sessão: `{ valor, aproximado }` ou `null`. */
  const curtidasColetadas = ref(null);

  const coletando = ref(false);
  /** `{ tipo: "sucesso" | "aviso" | "erro", texto }` ou `null`. */
  const resumoColeta = ref(null);

  /** Identifica a requisição mais recente, para descartar respostas atrasadas. */
  let ultimaRequisicao = 0;

  const temMais = computed(() => itens.value.length < total.value);

  async function carregarPagina(numero) {
    const id = publicacaoId.value;

    if (!id) return;

    const requisicao = ++ultimaRequisicao;

    carregando.value = true;
    erro.value = "";

    try {
      const resposta = await listarComentarios(id, {
        pagina: numero,
        limite: POR_PAGINA,
        incluirRemovidos: incluirRemovidos.value,
      });

      // Se o usuário trocou de publicação/filtro enquanto esperava, ignora.
      if (requisicao !== ultimaRequisicao) return;

      itens.value =
        numero === 1 ? resposta.itens : [...itens.value, ...resposta.itens];
      total.value = resposta.total;
      atualizadoEm.value = resposta.atualizado_em;
      pagina.value = numero;
    } catch (e) {
      if (requisicao !== ultimaRequisicao) return;

      console.error("Erro ao carregar comentários:", e);
      erro.value = e.message || "Não foi possível carregar os comentários.";
    } finally {
      if (requisicao === ultimaRequisicao) carregando.value = false;
    }
  }

  function reiniciar() {
    itens.value = [];
    total.value = 0;
    pagina.value = 1;
    atualizadoEm.value = null;
    resumoColeta.value = null;
    curtidasColetadas.value = null;
    erro.value = "";

    return carregarPagina(1);
  }

  function carregarMais() {
    if (carregando.value || !temMais.value) return Promise.resolve();

    return carregarPagina(pagina.value + 1);
  }

  /** Coleta novamente no Instagram e recarrega a lista. */
  async function coletar() {
    const id = publicacaoId.value;

    if (!id || coletando.value) return;

    coletando.value = true;
    resumoColeta.value = null;

    try {
      const r = await coletarComentarios(id);
      const partes = [`${r.novos} novo(s)`];

      if (r.reaparecidos) partes.push(`${r.reaparecidos} reapareceu(ram)`);
      if (r.removidos) partes.push(`${r.removidos} removido(s)`);

      if (r.curtidas !== null && r.curtidas !== undefined) {
        curtidasColetadas.value = {
          valor: r.curtidas,
          aproximado: r.curtidas_aproximado,
        };
      }

      const curtidas =
        curtidasColetadas.value && r.curtidas !== null
          ? ` ♡ ${formatarCurtidas(r.curtidas, r.curtidas_aproximado)} curtidas.`
          : " Contador de curtidas não encontrado.";

      resumoColeta.value = r.completa
        ? { tipo: "sucesso", texto: `Atualizado: ${partes.join(", ")}.${curtidas}` }
        : {
            tipo: "aviso",
            texto:
              `Coleta parcial (${partes.join(", ")}): nem todos os comentários ` +
              `foram carregados, então nenhuma remoção foi registrada.${curtidas}`,
          };

      await carregarPagina(1);
    } catch (e) {
      console.error("Erro ao coletar comentários:", e);
      resumoColeta.value = {
        tipo: "erro",
        texto: e.message || "Não foi possível coletar os comentários.",
      };
    } finally {
      coletando.value = false;
    }
  }

  watch(publicacaoId, (id) => {
    if (id) reiniciar();
  });

  watch(incluirRemovidos, () => {
    if (publicacaoId.value) carregarPagina(1);
  });

  return {
    itens,
    total,
    atualizadoEm,
    curtidasColetadas,
    carregando,
    erro,
    temMais,
    incluirRemovidos,
    coletando,
    resumoColeta,
    carregarMais,
    coletar,
  };
}
