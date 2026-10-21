<!--
  Botão "⋯" que abre um menu de ações.
  `itens`: [{ rotulo, acao, perigo?, separadorAntes?, desabilitado? }].
  Fecha ao escolher, ao clicar fora ou com Esc.
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
      @click.stop="aberto = !aberto"
    >
      ⋯
    </button>

    <div v-if="aberto" class="menu" role="menu">
      <template v-for="(item, i) in itens" :key="i">
        <hr v-if="item.separadorAntes" />
        <button
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
});
onBeforeUnmount(() => {
  document.removeEventListener("click", aoClicarFora);
  document.removeEventListener("keydown", aoTeclar);
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
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 30;
  width: 210px;
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

hr {
  margin: 4px 0;
  border: 0;
  border-top: 1px solid #eee;
}
</style>
