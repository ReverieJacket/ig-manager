<!--
  Tela inicial provisória do cliente.
  A área do cliente (Minhas postagens e Aprovações) chega nas etapas 2 e 3;
  por enquanto o cliente já consegue entrar e vê este aviso.
-->
<template>
  <div class="page">
    <div class="page-header">
      <h1>Olá, {{ primeiroNome }}!</h1>
      <p v-if="usuario?.cliente">Área de {{ usuario.cliente.nome }}</p>
    </div>

    <section class="cartao aviso">
      <strong>Sua área está sendo preparada.</strong>
      <span>
        Em breve você verá aqui as postagens publicadas e programadas das suas
        contas e poderá aprovar os posts enviados pelo administrador.
      </span>
    </section>
  </div>
</template>

<script setup>
import { computed } from "vue";

import { useSessao } from "../composables/useSessao";

const { usuario } = useSessao();

const primeiroNome = computed(() => usuario.value?.nome?.split(" ")[0] || "");
</script>

<style scoped>
.aviso {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 640px;
  padding: 24px;
  color: #444;
  font-size: 14px;
  line-height: 1.55;
}

.aviso strong {
  color: var(--cor-titulo);
  font-size: 15px;
}
</style>
