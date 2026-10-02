<!--
  Campos de data e horário do agendamento.
  Usa v-model:data e v-model:hora.
-->
<template>
  <div class="schedule-fields">
    <div>
      <label for="data">Data</label>
      <input
        id="data"
        v-model="data"
        class="campo"
        type="date"
        :min="dataMinima"
        :disabled="desabilitado"
      />
    </div>

    <div>
      <label for="horario">Horário</label>
      <input
        id="horario"
        v-model="hora"
        class="campo"
        type="time"
        :disabled="desabilitado"
      />
    </div>
  </div>
</template>

<script setup>
/**
 * @property {string} dataMinima - Menor data selecionável (AAAA-MM-DD).
 * @property {boolean} desabilitado - Bloqueia edição durante o envio.
 * @model data - Data escolhida (AAAA-MM-DD).
 * @model hora - Horário escolhido (HH:MM).
 */
defineProps({
  dataMinima: { type: String, required: true },
  desabilitado: { type: Boolean, default: false },
});

const data = defineModel("data", { type: String, default: "" });
const hora = defineModel("hora", { type: String, default: "" });
</script>

<style scoped>
.schedule-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 18px;
}

.schedule-fields div {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.schedule-fields label {
  color: #555;
  font-size: 12px;
  font-weight: 600;
}

.schedule-fields .campo {
  padding: 10px;
  border-radius: 7px;
}

@media (max-width: 650px) {
  .schedule-fields {
    grid-template-columns: 1fr;
  }
}
</style>
