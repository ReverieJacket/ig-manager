
<template>
  <AppLayout>
    <div class="create-page">
      <div class="page-header">
        <h1>Nova publicação</h1>
        <p>Crie uma nova publicação para o Instagram.</p>
      </div>

      <section class="create-card">
        <!-- CONTA DO INSTAGRAM -->
        <div class="form-section">
          <label for="conta">Conta do Instagram</label>

          <select
            id="conta"
            v-model="contaSelecionada"
            :disabled="carregandoContas || carregando"
          >
            <option value="" disabled>
              {{
                carregandoContas
                  ? "Carregando contas..."
                  : "Selecione uma conta"
              }}
            </option>

            <option
              v-for="conta in contas"
              :key="conta.id"
              :value="String(conta.id)"
            >
              {{ conta.nome }} ({{ conta.username }})
            </option>
          </select>

          <small v-if="erroContas" class="field-error">
            {{ erroContas }}
          </small>

          <small
            v-else-if="!carregandoContas && contas.length === 0"
            class="field-warning"
          >
            Nenhuma conta ativa cadastrada. Cadastre uma conta no Supabase.
          </small>
        </div>

        <!-- UPLOAD DA IMAGEM -->
        <div class="form-section">
          <label class="section-label">Imagem</label>

          <div
            class="upload-area"
            :class="{ 'has-image': preview }"
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
                alt="Pré-visualização da publicação"
              />

              <span class="change-image">
                Clique para trocar a imagem
              </span>
            </template>

            <template v-else>
              <div class="upload-icon">+</div>

              <strong>Adicionar uma imagem</strong>

              <span>Clique para selecionar uma imagem</span>

              <small>JPG, PNG ou WEBP — máximo 10 MB</small>
            </template>
          </div>
        </div>

        <!-- LEGENDA -->
        <div class="caption-section">
          <div class="caption-header">
            <label for="legenda">Legenda</label>
            <span>{{ texto.length }}/2200</span>
          </div>

          <textarea
            id="legenda"
            v-model="texto"
            maxlength="2200"
            placeholder="Escreva uma legenda para sua publicação..."
            :disabled="carregando"
          />
        </div>

        <!-- PUBLICAR AGORA -->
        <button
          type="button"
          class="publish-button"
          :disabled="!formularioValido || carregando || carregandoContas"
          @click="publicarAgora"
        >
          {{ carregando ? "Processando..." : "Publicar Agora" }}
        </button>

        <!-- AGENDAMENTO -->
        <div class="schedule-section">
          <label class="schedule-toggle">
            <input
              v-model="agendar"
              type="checkbox"
              :disabled="carregando"
            />

            <span>Deseja agendar publicação?</span>
          </label>

          <div v-if="agendar" class="schedule-fields">
            <div>
              <label for="data">Data</label>

              <input
                id="data"
                v-model="dataSelecionada"
                type="date"
                :min="dataMinima"
                :disabled="carregando"
              />
            </div>

            <div>
              <label for="horario">Horário</label>

              <input
                id="horario"
                v-model="horaSelecionada"
                type="time"
                :disabled="carregando"
              />
            </div>
          </div>

          <button
            v-if="agendar"
            type="button"
            class="schedule-button"
            :disabled="!formularioValido || carregando || carregandoContas"
            @click="agendarPublicacao"
          >
            {{ carregando ? "Agendando..." : "Agendar Publicação" }}
          </button>
        </div>

        <!-- MENSAGEM -->
        <div
          v-if="mensagem"
          class="message"
          :class="{
            success: sucesso,
            error: !sucesso
          }"
          role="status"
          aria-live="polite"
        >
          {{ mensagem }}
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import AppLayout from "../components/AppLayout.vue";

const API_URL = "http://localhost:3000";

const inputImagem = ref(null);
const arquivo = ref(null);
const preview = ref("");

const contas = ref([]);
const contaSelecionada = ref("");
const carregandoContas = ref(false);
const erroContas = ref("");

const texto = ref("");
const agendar = ref(false);
const dataSelecionada = ref("");
const horaSelecionada = ref("");

const mensagem = ref("");
const sucesso = ref(false);
const carregando = ref(false);

const dataMinima = computed(() => {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
});

const formularioValido = computed(() => {
  if (!contaSelecionada.value || !arquivo.value) {
    return false;
  }

  if (!texto.value.trim()) {
    return false;
  }

  if (!agendar.value) {
    return true;
  }

  return Boolean(dataSelecionada.value && horaSelecionada.value);
});

async function carregarContas() {
  carregandoContas.value = true;
  erroContas.value = "";

  try {
    const resposta = await fetch(`${API_URL}/contas`);
    const resultado = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        resultado.mensagem || "Não foi possível carregar as contas."
      );
    }

    contas.value = Array.isArray(resultado) ? resultado : [];

    if (contas.value.length === 1) {
      contaSelecionada.value = String(contas.value[0].id);
    }
  } catch (erro) {
    console.error("Erro ao carregar contas:", erro);
    erroContas.value =
      erro.message || "Erro ao carregar as contas do Instagram.";
  } finally {
    carregandoContas.value = false;
  }
}

function selecionarImagem() {
  if (carregando.value) return;
  inputImagem.value?.click();
}

function selecionarArquivo(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const tiposPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!tiposPermitidos.includes(file.type)) {
    mensagem.value = "Selecione uma imagem JPG, PNG ou WEBP.";
    sucesso.value = false;
    event.target.value = "";
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    mensagem.value = "A imagem deve ter no máximo 10 MB.";
    sucesso.value = false;
    event.target.value = "";
    return;
  }

  if (preview.value) {
    URL.revokeObjectURL(preview.value);
  }

  arquivo.value = file;
  preview.value = URL.createObjectURL(file);

  mensagem.value = "";
  sucesso.value = false;
}

function montarDataHoraAgendada() {
  if (!dataSelecionada.value || !horaSelecionada.value) {
    throw new Error("Informe a data e o horário da publicação.");
  }

  // O navegador interpreta esse valor no fuso horário local.
  const data = new Date(
    `${dataSelecionada.value}T${horaSelecionada.value}:00`
  );

  if (Number.isNaN(data.getTime())) {
    throw new Error("Data ou horário inválidos.");
  }

  if (data.getTime() <= Date.now()) {
    throw new Error("Selecione uma data e horário futuros.");
  }

  // Envia ISO com fuso explícito para o backend.
  return data.toISOString();
}

async function enviarPublicacao(dataHora) {
  if (!contaSelecionada.value) {
    throw new Error("Selecione uma conta do Instagram.");
  }

  if (!arquivo.value) {
    throw new Error("Selecione uma imagem.");
  }

  if (!texto.value.trim()) {
    throw new Error("Informe a legenda da publicação.");
  }

  const formData = new FormData();

  formData.append("imagem", arquivo.value);
  formData.append("texto", texto.value.trim());
  formData.append("dataHora", dataHora);
  formData.append("conta_id", contaSelecionada.value);

  const resposta = await fetch(`${API_URL}/publicacoes`, {
    method: "POST",
    body: formData
  });

  const resultado = await resposta.json();

  if (!resposta.ok || !resultado.sucesso) {
    throw new Error(
      resultado.mensagem || "Erro ao processar a publicação."
    );
  }

  return resultado;
}

async function publicarAgora() {
  if (!formularioValido.value) {
    mensagem.value =
      "Selecione uma conta, uma imagem e informe a legenda.";
    sucesso.value = false;
    return;
  }

  carregando.value = true;
  mensagem.value = "";
  sucesso.value = false;

  try {
    const resultado = await enviarPublicacao(
      new Date().toISOString()
    );

    sucesso.value = true;
    mensagem.value =
      resultado.mensagem || "Publicação processada com sucesso.";

    // Limpa o formulário após o envio.
    limparFormulario();
  } catch (erro) {
    console.error("Erro ao publicar:", erro);
    mensagem.value =
      erro.message || "Não foi possível publicar.";
    sucesso.value = false;
  } finally {
    carregando.value = false;
  }
}

async function agendarPublicacao() {
  if (!formularioValido.value) {
    mensagem.value =
      "Selecione uma conta, uma imagem, informe a legenda, a data e o horário.";
    sucesso.value = false;
    return;
  }

  carregando.value = true;
  mensagem.value = "";
  sucesso.value = false;

  try {
    const dataHora = montarDataHoraAgendada();
    const resultado = await enviarPublicacao(dataHora);

    sucesso.value = true;
    mensagem.value =
      resultado.mensagem || "Publicação agendada com sucesso.";

    limparFormulario();
  } catch (erro) {
    console.error("Erro ao agendar:", erro);
    mensagem.value =
      erro.message || "Não foi possível agendar a publicação.";
    sucesso.value = false;
  } finally {
    carregando.value = false;
  }
}

function limparFormulario() {
  if (preview.value) {
    URL.revokeObjectURL(preview.value);
  }

  arquivo.value = null;
  preview.value = "";
  texto.value = "";
  agendar.value = false;
  dataSelecionada.value = "";
  horaSelecionada.value = "";

  if (inputImagem.value) {
    inputImagem.value.value = "";
  }
}

onMounted(() => {
  carregarContas();
});

onUnmounted(() => {
  if (preview.value) {
    URL.revokeObjectURL(preview.value);
  }
});
</script>

<style scoped>
.create-page {
  width: 100%;
  max-width: 850px;
  margin: 0 auto;
  padding-bottom: 32px;
  box-sizing: border-box;
}

/* CABEÇALHO */
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

/* CARD */
.create-card {
  display: flex;
  flex-direction: column;
  gap: 22px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 11px;
  padding: 24px;
  box-sizing: border-box;
}

/* CAMPOS */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-section > label,
.section-label {
  color: #222;
  font-size: 13px;
  font-weight: 600;
}

.form-section select {
  width: 100%;
  padding: 12px;
  border: 1px solid #d8d8d8;
  border-radius: 8px;
  background: #fff;
  color: #333;
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.form-section select:focus {
  border-color: #888;
}

.field-error {
  color: #b42318;
  font-size: 12px;
}

.field-warning {
  color: #946200;
  font-size: 12px;
}

/* UPLOAD */
.upload-area {
  position: relative;
  width: 100%;
  height: 330px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1px dashed #ccc;
  border-radius: 9px;
  background: #fff;
  cursor: pointer;
  transition: background 0.15s ease;
  overflow: hidden;
}

.upload-area:hover {
  background: #fafafa;
}

.upload-area.has-image {
  border-style: solid;
  border-color: #ddd;
  background: #f8f8f8;
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

.upload-area .change-image {
  position: absolute;
  right: 12px;
  bottom: 12px;
  margin: 0;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(20, 20, 20, 0.8);
  color: #fff;
  font-size: 12px;
}

/* LEGENDA */
.caption-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.caption-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  min-height: 110px;
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

/* BOTÃO PUBLICAR */
.publish-button {
  width: 100%;
  padding: 13px;
  border: none;
  border-radius: 8px;
  background: #252525;
  color: white;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.publish-button:hover:not(:disabled) {
  background: #111;
}

.publish-button:disabled,
.schedule-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* AGENDAMENTO */
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
  accent-color: #252525;
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
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid #d8d8d8;
  border-radius: 7px;
  outline: none;
  font-family: inherit;
  font-size: 13px;
}

.schedule-fields input:focus {
  border-color: #aaa;
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
  transition: background 0.15s ease;
}

.schedule-button:hover:not(:disabled) {
  background: #f5f5f5;
}

/* MENSAGEM */
.message {
  padding: 12px;
  border-radius: 7px;
  font-size: 13px;
  text-align: center;
  overflow-wrap: anywhere;
}

.message.success {
  background: #eaf7ee;
  color: #216e39;
}

.message.error {
  background: #fef0f0;
  color: #b42318;
}

/* RESPONSIVO */
@media (max-width: 650px) {
  .create-page {
    padding: 0 12px 24px;
  }

  .page-header h1 {
    font-size: 22px;
  }

  .create-card {
    padding: 15px;
    gap: 18px;
  }

  .upload-area {
    height: 270px;
  }

  .schedule-fields {
    grid-template-columns: 1fr;
  }
}
</style>