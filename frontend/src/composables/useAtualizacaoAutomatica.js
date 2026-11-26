/**
 * Atualiza a tela sozinha, sem o usuário recarregar a página.
 *
 * - a cada `intervaloMs` (padrão 15 s), só com a aba visível;
 * - na hora em que a pessoa volta para a aba ou para a janela;
 * - nunca enquanto ela digita num campo (não apaga o que está escrevendo)
 *   nem com uma janela modal aberta.
 *
 * A função recebida deve atualizar os dados "em silêncio" (sem mostrar
 * "Carregando..." nem limpar a tela).
 *
 * @param {() => Promise<unknown>} atualizar
 * @param {{intervaloMs?: number}} [opcoes]
 */
import { onBeforeUnmount, onMounted } from "vue";

const INTERVALO_PADRAO_MS = 15 * 1000;
/** Intervalo mínimo entre duas atualizações (foco + intervalo juntos). */
const MINIMO_ENTRE_ATUALIZACOES_MS = 4 * 1000;

function pessoaOcupada() {
  const ativo = document.activeElement;
  const digitando =
    ativo &&
    (ativo.tagName === "TEXTAREA" ||
      ativo.tagName === "SELECT" ||
      (ativo.tagName === "INPUT" && !["checkbox", "radio", "button", "submit"].includes(ativo.type)) ||
      ativo.isContentEditable);
  const modalAberto = Boolean(document.querySelector(".modal-fundo"));
  return digitando || modalAberto;
}

export function useAtualizacaoAutomatica(atualizar, { intervaloMs = INTERVALO_PADRAO_MS } = {}) {
  let timer = null;
  let ultima = Date.now();
  let emAndamento = false;

  async function talvezAtualizar() {
    if (document.visibilityState !== "visible" || emAndamento || pessoaOcupada()) return;
    if (Date.now() - ultima < MINIMO_ENTRE_ATUALIZACOES_MS) return;
    emAndamento = true;
    ultima = Date.now();
    try {
      await atualizar();
    } catch {
      // A próxima tentativa resolve; erros aparecem nas ações da pessoa.
    } finally {
      emAndamento = false;
    }
  }

  function aoVoltar() {
    if (document.visibilityState === "visible") talvezAtualizar();
  }

  onMounted(() => {
    timer = setInterval(talvezAtualizar, intervaloMs);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
  });

  onBeforeUnmount(() => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", aoVoltar);
    window.removeEventListener("focus", aoVoltar);
  });

  return { atualizarAgora: talvezAtualizar };
}
