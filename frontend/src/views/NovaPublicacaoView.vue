<!--
  Tela "Criar": formulário para publicar agora ou agendar.
  Estado e envio ficam em `useFormularioPublicacao`; os perfis vêm de
  GET /perfis (agrupados por cliente em `SeletorPerfis`).
-->
<template>
  <div class="create-page">
    <div class="page-header">
      <h1>Nova publicação</h1>
      <p>Crie uma nova publicação para o Instagram.</p>
    </div>

    <section class="cartao create-card">
      <!-- Perfis do Instagram -->
      <div class="form-section">
        <label>Perfis do Instagram</label>
        <SeletorPerfis
          v-model="form.contaIds.value"
          :perfis="perfis"
          :carregando="carregandoPerfis"
          :desabilitado="form.enviando.value"
          :permitir-nao-conectados="form.agendar.value"
        />
        <small v-if="erroPerfis" class="field-error">{{ erroPerfis }}</small>
        <small v-else class="field-hint">
          Selecione um ou mais perfis para publicar o mesmo conteúdo.
          <template v-if="!form.agendar.value && perfis.some((p) => p.status !== 'conectado')">
            Perfis sem conexão só podem receber publicação agendada.
          </template>
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
        {{ form.enviando.value ? "Processando..." : textoPublicar }}
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

          <p class="aviso-aprovacao">
            O cliente precisa <strong>deferir</strong> em "Aprovações" até o horário.
            Sem resposta até lá, a publicação <strong>não sai</strong>. Se ele aprovar por fora,
            use "Deferir pelo cliente" em Postagens.
          </p>

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
import { computed, onMounted, ref } from "vue";

import CampoAgendamento from "../components/publicacoes/CampoAgendamento.vue";
import SeletorPerfis from "../components/publicacoes/SeletorPerfis.vue";
import UploadImagem from "../components/publicacoes/UploadImagem.vue";
import { listarPerfis } from "../api/perfis";
import { LIMITE_LEGENDA } from "../constants/publicacoes";
import { useFormularioPublicacao } from "../composables/useFormularioPublicacao";

const form = useFormularioPublicacao();

const perfis = ref([]);
const carregandoPerfis = ref(true);
const erroPerfis = ref("");

onMounted(async () => {
  try {
    perfis.value = await listarPerfis();
    // Com um único perfil conectado, já o deixa selecionado.
    const conectados = perfis.value.filter((p) => p.status === "conectado");
    if (conectados.length === 1) form.contaIds.value = [String(conectados[0].id)];
  } catch (e) {
    erroPerfis.value = e.message || "Não foi possível carregar os perfis.";
  } finally {
    carregandoPerfis.value = false;
  }
});

const textoPublicar = computed(() => {
  const n = form.contaIds.value.length;
  return n > 1 ? `Publicar agora em ${n} perfis` : "Publicar agora";
});

/** Botões de envio ficam bloqueados enquanto houver pendência. */
const bloqueado = computed(
  () =>
    !form.formularioValido.value ||
    form.enviando.value ||
    carregandoPerfis.value
);
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

.field-hint {
  color: #777;
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

.aviso-aprovacao {
  margin: 14px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff6e0;
  color: #7a5200;
  font-size: 12.5px;
  line-height: 1.5;
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
    padding: 0 0 24px;
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
