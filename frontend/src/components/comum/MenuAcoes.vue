<!--
  Botão "⋯" que abre um menu de ações.
  `itens`: [{ rotulo, acao, perigo?, separadorAntes?, desabilitado? }]
  ou { titulo } para um cabeçalho de grupo (não clicável).
  Fecha ao escolher, ao clicar fora, com Esc ou ao rolar a página.

  O menu usa posição fixa (calculada a partir do botão) para não ser
  cortado por tabelas com rolagem; abre para cima perto do rodapé.
-->
<template>
  <div ref="raiz" class="menu-acoes">
    <button
      type="button"
      class="gatilho"
      :class="{ aberto, grande }"
      :aria-expanded="aberto"
      aria-haspopup="menu"
      :aria-label="rotulo"
      :title="rotulo"
      @click.stop="alternar"
    >
      ⋯
    </button>

    <div v-if="aberto" class="menu" role="menu" :style="posicao">
      <template v-for="(item, i) in itens" :key="i">
        <hr v-if="item.separadorAntes" />
        <div v-if="item.titulo" class="titulo">{{ item.titulo }}</div>
        <button
          v-else
          type="button"
          role="menuitem"
          class="item"
          :class="{ perigo: item.perigo }"
          :disabled="item.desabilitado"
          @click="escolher(item)"
        >
          {{ item.rotulo }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

defineProps({
  itens: { type: Array, required: true },
  rotulo: { type: String, default: "Mais ações" },
  /** Versão maior (cabeçalho do cliente). */
  grande: { type: Boolean, default: false },
});

const aberto = ref(false);
const raiz = ref(null);
const posicao = ref({});

/** Altura aproximada do menu, para decidir se abre para cima. */
const ALTURA_ESTIMADA = 44 * 4;

function alternar() {
  if (aberto.value) {
    aberto.value = false;
    return;
  }
  const r = raiz.value.getBoundingClientRect();
  const direita = `${Math.max(8, window.innerWidth - r.right)}px`;
  posicao.value =
    r.bottom + ALTURA_ESTIMADA > window.innerHeight
      ? { bottom: `${window.innerHeight - r.top + 6}px`, right: direita }
      : { top: `${r.bottom + 6}px`, right: direita };
  aberto.value = true;
}

function fecharAoRolar() {
  aberto.value = false;
}

function escolher(item) {
  aberto.value = false;
  item.acao?.();
}

function aoClicarFora(evento) {
  if (raiz.value && !raiz.value.contains(evento.target)) aberto.value = false;
}

function aoTeclar(evento) {
  if (evento.key === "Escape") aberto.value = false;
}

onMounted(() => {
  document.addEventListener("click", aoClicarFora);
  document.addEventListener("keydown", aoTeclar);
  window.addEventListener("scroll", fecharAoRolar, true);
  window.addEventListener("resize", fecharAoRolar);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", aoClicarFora);
  document.removeEventListener("keydown", aoTeclar);
  window.removeEventListener("scroll", fecharAoRolar, true);
  window.removeEventListener("resize", fecharAoRolar);
});
</script>

<style scoped>
.menu-acoes {
  position: relative;
  flex: none;
}

.gatilho {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #777;
  font-size: 18px;
  letter-spacing: 1px;
  cursor: pointer;
}

.gatilho:hover,
.gatilho.aberto {
  background: #f1f1f1;
  color: #222;
}

.gatilho.grande {
  width: 38px;
  height: 38px;
  border-color: #ddd;
  background: #fff;
}

.menu {
  position: fixed;
  z-index: 60;
  width: 220px;
  padding: 6px;
  border: 1px solid #e2e2e2;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.14);
}

.item {
  display: block;
  width: 100%;
  padding: 9px 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #333;
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
}

.item:hover:not(:disabled) {
  background: #f3f3f3;
}

.item:disabled {
  color: #aaa;
  cursor: default;
}

.item.perigo {
  color: var(--cor-erro-texto);
}

.titulo {
  padding: 6px 12px 3px;
  color: #999;
  font-size: 11px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

hr {
  margin: 4px 0;
  border: 0;
  border-top: 1px solid #eee;
}
</style>
