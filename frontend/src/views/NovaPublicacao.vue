<template>
  <AppLayout>

    <div class="create-page">

      <div class="page-header">
        <h1>Nova publicação</h1>

        <p>
          Crie uma nova publicação para o Instagram.
        </p>
      </div>

      <section class="create-card">

        <!-- UPLOAD -->
        <div
          class="upload-area"
          @click="selecionarImagem"
        >

          <input
            ref="inputImagem"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            @change="selecionarArquivo"
          />

          <template v-if="preview">

            <img
              :src="preview"
              class="preview"
              alt="Pré-visualização"
            />

          </template>

          <template v-else>

            <div class="upload-icon">
              +
            </div>

            <strong>
              Adicionar uma imagem
            </strong>

            <span>
              Clique para selecionar uma imagem
            </span>

            <small>
              JPG, PNG ou WEBP
            </small>

          </template>

        </div>

        <!-- LEGENDA -->
        <div class="caption-section">

          <div class="caption-header">

            <label>
              Legenda
            </label>

            <span>
              {{ texto.length }}/2200
            </span>

          </div>

          <textarea
            v-model="texto"
            maxlength="2200"
            placeholder="Escreva uma legenda para sua publicação..."
          />

        </div>

        <!-- PUBLICAR -->
        <button
          class="publish-button"
          :disabled="carregando"
          @click="publicarAgora"
        >
          {{ carregando ? "Publicando..." : "Publicar Agora" }}
        </button>

        <!-- AGENDAMENTO -->
        <div class="schedule-section">

          <label class="schedule-toggle">

            <input
              v-model="agendar"
              type="checkbox"
            />

            <span>
              Deseja agendar publicação?
            </span>

          </label>

          <div
            v-if="agendar"
            class="schedule-fields"
          >

            <div>
              <label>Data</label>

              <input
                v-model="dataSelecionada"
                type="date"
              />
            </div>

            <div>
              <label>Horário</label>

              <input
                v-model="horaSelecionada"
                type="time"
              />
            </div>

          </div>

          <button
            v-if="agendar"
            class="schedule-button"
            :disabled="carregando"
            @click="agendarPublicacao"
          >
            {{ carregando ? "Agendando..." : "Agendar Publicação" }}
          </button>

        </div>

        <!-- MENSAGEM -->
        <div
          v-if="mensagem"
          class="message"
          :class="{ success: sucesso }"
        >
          {{ mensagem }}
        </div>

      </section>

    </div>

  </AppLayout>
</template>

<script setup>
import { computed, ref } from "vue";
import AppLayout from "../components/AppLayout.vue";

const inputImagem = ref(null);

const arquivo = ref(null);
const preview = ref("");

const texto = ref("");

const agendar = ref(false);
const dataSelecionada = ref("");
const horaSelecionada = ref("");

const mensagem = ref("");
const sucesso = ref(false);
const carregando = ref(false);

function selecionarImagem() {
  inputImagem.value?.click();
}

function selecionarArquivo(event) {

  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  arquivo.value = file;

  preview.value = URL.createObjectURL(file);

  mensagem.value = "";
}

const formularioValido = computed(() => {

  if (!arquivo.value) {
    return false;
  }

  if (!agendar.value) {
    return true;
  }

  return (
    dataSelecionada.value &&
    horaSelecionada.value
  );
});

async function enviarPublicacao(dataHora) {

  if (!arquivo.value) {
    mensagem.value = "Selecione uma imagem.";
    sucesso.value = false;
    return;
  }

  const formData = new FormData();

  formData.append("imagem", arquivo.value);
  formData.append("texto", texto.value);

  if (dataHora) {
    formData.append("dataHora", dataHora);
  }

  const resposta = await fetch(
    "http://localhost:3000/publicacoes",
    {
      method: "POST",
      body: formData
    }
  );

  const resultado = await resposta.json();

  if (!resposta.ok) {
    throw new Error(
      resultado.mensagem ||
      "Erro ao processar publicação."
    );
  }

  return resultado;
}

async function publicarAgora() {

  if (!arquivo.value) {
    mensagem.value = "Selecione uma imagem antes de publicar.";
    sucesso.value = false;
    return;
  }

  carregando.value = true;
  mensagem.value = "";

  try {

    const agora = new Date();

    const dataAtual =
      agora.toLocaleDateString("sv-SE");

    const horaAtual =
      agora.toTimeString().slice(0, 5);

    await enviarPublicacao(
      `${dataAtual}T${horaAtual}`
    );

    sucesso.value = true;

    mensagem.value =
      "Publicação enviada com sucesso.";

  } catch (error) {

    console.error(error);

    sucesso.value = false;

    mensagem.value =
      error.message ||
      "Não foi possível publicar.";

  } finally {

    carregando.value = false;

  }
}

async function agendarPublicacao() {

  if (
    !dataSelecionada.value ||
    !horaSelecionada.value
  ) {
    mensagem.value =
      "Informe a data e o horário.";

    sucesso.value = false;

    return;
  }

  carregando.value = true;
  mensagem.value = "";

  try {

    await enviarPublicacao(
      `${dataSelecionada.value}T${horaSelecionada.value}`
    );

    sucesso.value = true;

    mensagem.value =
      "Publicação agendada com sucesso.";

  } catch (error) {

    console.error(error);

    sucesso.value = false;

    mensagem.value =
      error.message ||
      "Não foi possível agendar.";

  } finally {

    carregando.value = false;

  }
}
</script>

<style scoped>

.create-page {
  width: 100%;
  max-width: 850px;
  margin: 0 auto;
}

/* =========================
   CABEÇALHO
========================= */

.page-header {
  margin-bottom: 28px;
}

.page-header h1 {
  margin: 0 0 8px;

  color: #151515;

  font-size: 26px;
  font-weight: 700;
}

.page-header p {
  margin: 0;

  color: #777;

  font-size: 14px;
}

/* =========================
   CARD
========================= */

.create-card {
  background: #ffffff;

  border: 1px solid #dddddd;
  border-radius: 11px;

  padding: 24px;

  box-sizing: border-box;
}

/* =========================
   UPLOAD
========================= */

.upload-area {
  width: 100%;
  height: 330px;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  box-sizing: border-box;

  border: 1px dashed #cccccc;
  border-radius: 9px;

  background: #fff;

  cursor: pointer;

  transition: background 0.15s ease;
}

.upload-area:hover {
  background: #fafafa;
}

.upload-icon {
  width: 59px;
  height: 59px;

  display: flex;
  align-items: center;
  justify-content: center;

  margin-bottom: 15px;

  border-radius: 50%;

  background: #252525;

  color: white;

  font-size: 30px;
  font-weight: 300;
}

.upload-area strong {
  margin-bottom: 7px;

  color: #222;

  font-size: 16px;
}

.upload-area span {
  margin-bottom: 10px;

  color: #777;

  font-size: 14px;
}

.upload-area small {
  color: #aaa;

  font-size: 12px;
}

.preview {
  width: 100%;
  height: 100%;

  object-fit: contain;

  border-radius: 8px;
}

/* =========================
   LEGENDA
========================= */

.caption-section {
  margin-top: 22px;
}

.caption-header {
  display: flex;
  justify-content: space-between;

  margin-bottom: 6px;
}

.caption-header label {
  color: #222;

  font-size: 13px;
  font-weight: 600;
}

.caption-header span {
  color: #888;

  font-size: 11px;
}

textarea {
  width: 100%;
  min-height: 100px;

  box-sizing: border-box;

  padding: 13px;

  resize: vertical;

  border: 1px solid #d8d8d8;
  border-radius: 8px;

  outline: none;

  color: #333;

  font-family: inherit;
  font-size: 13px;
}

textarea::placeholder {
  color: #999;
}

textarea:focus {
  border-color: #aaa;
}

/* =========================
   PUBLICAR
========================= */

.publish-button {
  width: 100%;

  margin-top: 18px;

  padding: 13px;

  border: none;
  border-radius: 8px;

  background: #252525;
  color: white;

  font-family: inherit;

  font-size: 14px;
  font-weight: 600;

  cursor: pointer;
}

.publish-button:hover {
  background: #111;
}

.publish-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* =========================
   AGENDAMENTO
========================= */

.schedule-section {
  margin-top: 24px;

  padding-top: 20px;

  border-top: 1px solid #eeeeee;
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
}

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

.schedule-fields input {
  padding: 10px;

  border: 1px solid #d8d8d8;
  border-radius: 7px;

  outline: none;

  font-family: inherit;
  font-size: 13px;
}

.schedule-button {
  width: 100%;

  margin-top: 15px;

  padding: 12px;

  border: 1px solid #ccc;
  border-radius: 8px;

  background: white;
  color: #333;

  font-family: inherit;
  font-size: 14px;
  font-weight: 600;

  cursor: pointer;
}

.schedule-button:hover {
  background: #f5f5f5;
}

/* =========================
   MENSAGEM
========================= */

.message {
  margin-top: 15px;

  padding: 12px;

  border-radius: 7px;

  background: #f0f0f0;

  color: #444;

  font-size: 13px;

  text-align: center;
}

.message.success {
  background: #eeeeee;
  color: #222;
}

/* =========================
   RESPONSIVO
========================= */

@media (max-width: 650px) {

  .create-card {
    padding: 15px;
  }

  .upload-area {
    height: 270px;
  }

  .schedule-fields {
    grid-template-columns: 1fr;
  }

}

</style>