<!--
  Cartões de resumo com a quantidade de publicações por status.
  Reaproveita as abas de filtro como fonte dos rótulos (exceto "Todas").
-->
<template>
  <div class="summary-grid">
    <div v-for="item in itens" :key="item.valor" class="summary-card">
      <span>{{ item.rotulo }}</span>
      <strong>{{ contagens[item.valor] ?? 0 }}</strong>
    </div>
  </div>
</template>

<script setup>
import { ABAS_FILTRO, FILTRO_TODAS } from "../../constants/publicacoes";

/**
 * @property {Object<string, number>} contagens - Quantidade por status
 *   (ex.: `{ publicada: 3, agendada: 1 }`).
 */
defineProps({
  contagens: { type: Object, required: true },
});

const itens = ABAS_FILTRO.filter((aba) => aba.valor !== FILTRO_TODAS);
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 18px;
}

.summary-card {
  padding: 17px 18px;
  background: white;
  border: 1px solid var(--cor-borda);
  border-radius: 9px;
}

.summary-card span {
  display: block;
  margin-bottom: 7px;
  color: var(--cor-texto-suave);
  font-size: 12px;
}

.summary-card strong {
  color: var(--cor-texto);
  font-size: 22px;
}

@media (max-width: 950px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
