<!--
  Tela "Criar": formulário para publicar agora ou agendar.
  Estado e envio ficam em `useFormularioPublicacao`; a lista de contas
  em `useContas`.
-->
<template>
  <div class="create-page">
    <div class="page-header">
      <h1>Nova publicação</h1>
      <p>Crie uma nova publicação para o Instagram.</p>
    </div>

    <section class="cartao create-card">
      <!-- Conta -->
      <div class="form-section">
        <label for="conta">Conta do Instagram</label>

        <select
          id="conta"
          v-model="form.contaId.value"
          class="campo"
          :disabled="carregandoContas || form.enviando.value"
        >
          <option value="" disabled>
            {{ carregandoContas ? "Carregando contas..." : "Selecione uma conta" }}
          </option>

          <option
            v-for="conta in contas"
            :key="conta.id"
            :value="String(conta.id)"
          >
            {{ conta.nome }} ({{ conta.username }})
          </option>
        </select>

        <small v-if="erroContas" class="field-error">{{ erroContas }}</small>

        <small
          v-else-if="!carregandoContas && contas.length === 0"
          class="field-warning"
        >
          Nenhuma conta ativa cadastrada. Cadastre uma conta no Supabase.
        </small>
      </div>

      <!-- Imagem -->
      <div class="form-section">
        <label>Imagem</label>

        <UploadImagem
          :previa="form.previa.value"
          :desabilitado="form.enviando.value"
          @selecionar="form.escolherArquivo"
        />
      </div>

      <!-- Legenda -->
      <div class="form-section">
        <div class="caption-header">
          <label for="legenda">Legenda</label>
          <span>{{ form.texto.value.length }}/{{ LIMITE_LEGENDA }}</span>
        </div>

        <textarea
          id="legenda"
          v-model="form.texto.value"
          class="campo"
          :maxlength="LIMITE_LEGENDA"
          placeholder="Escreva uma legenda para sua publicação..."
          :disabled="form.enviando.value"
        />
      </div>

      <button
        type="button"
        class="botao botao--primario"
        :disabled="bloqueado"
        @click="form.enviar({ agendado: false })"
      >
        {{ form.enviando.value ? "Processando..." : "Publicar Agora" }}
      </button>

      <!-- Agendamento -->
      <div class="schedule-section">
        <label class="schedule-toggle">
          <input
            v-model="form.agendar.value"
            type="checkbox"
            :disabled="form.enviando.value"
          />
          <span>Deseja agendar publicação?</span>
        </label>

        <template v-if="form.agendar.value">
          <CampoAgendamento
            v-model:data="form.data.value"
            v-model:hora="form.hora.value"
            :data-minima="form.dataMinima.value"
            :desabilitado="form.enviando.value"
          />

          <button
            type="button"
            class="botao botao--secundario schedule-button"
            :disabled="bloqueado"
            @click="form.enviar({ agendado: true })"
          >
            {{ form.enviando.value ? "Agendando..." : "Agendar Publicação" }}
          </button>
        </template>
      </div>

      <p v-if="form.enviando.value" class="progress-hint" role="status">
        A publicação é feita por um navegador automático e pode levar cerca de
        1 minuto. Não feche a janela do navegador que abrir; ela fecha sozinha
        ao terminar.
      </p>

      <div
        v-if="form.mensagem.value"
        class="message"
        :class="
          form.sucesso.value ? 'success' : form.incerto.value ? 'warning' : 'error'
        "
        role="status"
        aria-live="polite"
      >
        <strong v-if="form.sucesso.value">✓ </strong>
        <strong v-else-if="form.incerto.value">⚠ Confira o perfil: </strong>
        {{ form.mensagem.value }}
        <router-link v-if="form.sucesso.value" to="/postagens">
          Ver em Postagens
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, watch } from "vue";

import CampoAgendamento from "../components/publicacoes/CampoAgendamento.vue";
import UploadImagem from "../components/publicacoes/UploadImagem.vue";
import { LIMITE_LEGENDA } from "../constants/publicacoes";
import { useContas } from "../composables/useContas";
import { useFormularioPublicacao } from "../composables/useFormularioPublicacao";

const form = useFormularioPublicacao();
const { contas, carregando: carregandoContas, erro: erroContas } = useContas();

/** Botões de envio ficam bloqueados enquanto houver pendência. */
const bloqueado = computed(
  () =>
    !form.formularioValido.value ||
    form.enviando.value ||
    carregandoContas.value
);

// Com uma única conta ativa, já a deixa selecionada.
watch(contas, (lista) => {
  if (lista.length === 1) form.contaId.value = String(lista[0].id);
});
</script>

<style scoped>
.create-page {
  width: 100%;
  max-width: 850px;
  margin: 0 auto;
  padding-bottom: 32px;
}

.create-card {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 24px;
  border-radius: 11px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-section label,
.caption-header label {
  color: var(--cor-texto);
  font-size: 13px;
  font-weight: 600;
}

.caption-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.caption-header span {
  color: #888;
  font-size: 11px;
}

textarea.campo {
  min-height: 110px;
  padding: 13px;
  resize: vertical;
}

.field-error {
  color: var(--cor-erro-texto);
  font-size: 12px;
}

.field-warning {
  color: #946200;
  font-size: 12px;
}

.schedule-section {
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.schedule-toggle {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #333;
  font-size: 13px;
  cursor: pointer;
}

.schedule-toggle input {
  width: 15px;
  height: 15px;
  accent-color: var(--cor-primaria);
}

.schedule-button {
  width: 100%;
  margin-top: 15px;
}

.message {
  padding: 12px;
  border-radius: 7px;
  font-size: 13px;
  text-align: center;
  overflow-wrap: anywhere;
}

.message.success {
  background: var(--cor-sucesso-fundo);
  color: var(--cor-sucesso-texto);
}

.message.warning {
  background: #fff6e0;
  color: #7a5200;
}

.message a {
  margin-left: 6px;
  color: inherit;
  font-weight: 600;
}

.progress-hint {
  margin: 0;
  color: var(--cor-texto-suave);
  font-size: 12px;
  text-align: center;
}

.message.error {
  background: var(--cor-erro-fundo);
  color: var(--cor-erro-texto);
}

@media (max-width: 650px) {
  .create-page {
    padding: 0 12px 24px;
  }

  .page-header h1 {
    font-size: 22px;
  }

  .create-card {
    gap: 18px;
    padding: 15px;
  }
}
</style>
