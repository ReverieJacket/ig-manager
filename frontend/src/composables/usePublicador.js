/**
 * Situação do Publicador (app no computador do administrador), para o
 * aviso no topo das telas do administrador.
 *
 * Estado único (fora da função): o layout e as telas veem o mesmo valor.
 * Consulta no máximo a cada 30 s (troca de tela) e de 1 em 1 minuto.
 */
import { computed, ref } from "vue";

import { obterConfigPerfis } from "../api/perfis";

const situacao = ref(null);
let ultimaBusca = 0;
let timer = null;

const INTERVALO_MS = 30 * 1000;

export function usePublicador() {
  async function atualizar({ forcar = false } = {}) {
    if (!forcar && Date.now() - ultimaBusca < INTERVALO_MS) return;
    ultimaBusca = Date.now();
    try {
      situacao.value = await obterConfigPerfis();
    } catch {
      // Mantém o último valor: o aviso é um extra.
    }
  }

  /** Começa a conferir de 1 em 1 minuto (chamado pelo layout do admin). */
  function acompanhar() {
    atualizar({ forcar: true });
    if (!timer) timer = setInterval(() => atualizar({ forcar: true }), 60 * 1000);
  }

  function parar() {
    clearInterval(timer);
    timer = null;
  }

  /** Só no site publicado (Vercel) o Publicador fica em outro computador. */
  const desligado = computed(
    () => situacao.value?.modo === "api" && situacao.value?.publicador && !situacao.value.publicador.online
  );

  return { situacao, desligado, atualizar, acompanhar, parar };
}
