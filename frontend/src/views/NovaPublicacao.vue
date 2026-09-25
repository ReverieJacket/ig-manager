<template>
  <div class="app">

    <!-- SIDEBAR -->
    <aside class="sidebar">

      <div class="logo">
        <span class="logo-icon">◎</span>
        <span>IG Manager</span>
      </div>

      <nav class="menu">

        <button class="menu-item">
          <span class="menu-icon">⌂</span>
          <span>Início</span>
        </button>

        <button class="menu-item active">
          <span class="menu-icon">＋</span>
          <span>Criar</span>
        </button>

      </nav>

    </aside>


    <!-- CONTEÚDO -->
    <main class="content">

      <header class="topbar">

        <div>
          <h1>Nova publicação</h1>

          <p>
            Crie uma nova publicação para o Instagram.
          </p>
        </div>

      </header>


      <section class="create-area">

        <div class="publication-card">


          <!-- =========================
               IMAGEM
          ========================== -->

          <div
            class="upload-area"
            :class="{ 'has-image': previewUrl }"
            @click="abrirArquivo"
          >

            <template v-if="previewUrl">

              <img
                :src="previewUrl"
                alt="Pré-visualização da imagem"
                class="preview"
              />

              <div class="change-image">
                Alterar imagem
              </div>

            </template>


            <template v-else>

              <div class="upload-icon">
                ＋
              </div>

              <h3>
                Adicionar uma imagem
              </h3>

              <p>
                Clique para selecionar uma imagem
              </p>

              <span class="formats">
                JPG, PNG ou WEBP
              </span>

            </template>


            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="selecionarImagem"
              hidden
            />

          </div>


          <!-- =========================
               LEGENDA
          ========================== -->

          <div class="field">

            <div class="field-header">

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
            ></textarea>

          </div>


          <!-- =========================
               PUBLICAR AGORA
          ========================== -->

          <button
            class="publish-button"
            :disabled="!podePublicarAgora || enviando"
            @click="publicarAgora"
          >

            <span v-if="enviando">
              Publicando...
            </span>

            <span v-else>
              Publicar Agora
            </span>

          </button>


          <!-- =========================
               AGENDAMENTO
          ========================== -->

          <div class="schedule-option">

            <label class="schedule-label">

              <span>
                Deseja agendar publicação?
              </span>

              <input
                v-model="agendar"
                type="checkbox"
              />

              <span class="switch"></span>

            </label>

          </div>


          <!-- =========================
               DATA E HORÁRIO
          ========================== -->

          <div
            v-if="agendar"
            class="schedule-fields"
          >

            <!-- DATA -->

            <div class="field">

              <label>
                Data
              </label>

              <div class="input-with-icon">

                <input
                  v-model="dataSelecionada"
                  type="date"
                  class="datetime"
                />

                <span class="calendar-icon">
                  ▣
                </span>

              </div>

            </div>


            <!-- HORÁRIO -->

            <div class="field">

              <label>
                Horário
              </label>

              <div class="input-with-icon">

                <input
                  v-model="horaSelecionada"
                  type="time"
                  class="datetime"
                />

                <span class="clock-icon">
                  ◷
                </span>

              </div>

            </div>

          </div>


          <!-- =========================
               BOTÃO AGENDAR
          ========================== -->

          <button
            v-if="agendar"
            class="schedule-button"
            :disabled="!podeAgendar || enviando"
            @click="agendarPublicacao"
          >

            <span v-if="enviando">
              Agendando...
            </span>

            <span v-else>
              Agendar Publicação
            </span>

          </button>


          <!-- =========================
               MENSAGEM
          ========================== -->

          <div
            v-if="mensagem"
            class="message"
            :class="sucesso ? 'success' : 'error'"
          >
            {{ mensagem }}
          </div>


        </div>

      </section>

    </main>

  </div>
</template>


<script setup>

import {
  ref,
  computed,
  onUnmounted
} from "vue";


/* =====================================================
   INPUT DE ARQUIVO
===================================================== */

const fileInput = ref(null);


/* =====================================================
   IMAGEM
===================================================== */

const imagem = ref(null);

const previewUrl = ref(null);


/* =====================================================
   FORMULÁRIO
===================================================== */

const texto = ref("");

const dataSelecionada = ref("");

const horaSelecionada = ref("");

const agendar = ref(false);


/* =====================================================
   STATUS
===================================================== */

const mensagem = ref("");

const sucesso = ref(false);

const enviando = ref(false);


/* =====================================================
   VALIDAÇÃO
===================================================== */

const podePublicarAgora = computed(() => {

  return (
    imagem.value &&
    texto.value.trim()
  );

});


const podeAgendar = computed(() => {

  return (
    imagem.value &&
    texto.value.trim() &&
    dataSelecionada.value &&
    horaSelecionada.value
  );

});


/* =====================================================
   ABRIR SELETOR
===================================================== */

function abrirArquivo() {

  fileInput.value?.click();

}


/* =====================================================
   SELECIONAR IMAGEM
===================================================== */

function selecionarImagem(event) {

  const arquivo = event.target.files?.[0];


  if (!arquivo) {
    return;
  }


  const tiposPermitidos = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];


  if (!tiposPermitidos.includes(arquivo.type)) {

    mensagem.value =
      "Selecione uma imagem JPG, PNG ou WEBP.";

    sucesso.value = false;

    return;

  }


  imagem.value = arquivo;


  if (previewUrl.value) {

    URL.revokeObjectURL(
      previewUrl.value
    );

  }


  previewUrl.value =
    URL.createObjectURL(arquivo);


  mensagem.value = "";

}


/* =====================================================
   PUBLICAR AGORA
===================================================== */

async function publicarAgora() {

  if (
    !podePublicarAgora.value ||
    enviando.value
  ) {
    return;
  }


  enviando.value = true;

  mensagem.value = "";


  try {

    const formData =
      new FormData();


    formData.append(
      "imagem",
      imagem.value
    );


    formData.append(
      "texto",
      texto.value
    );


    /*
     * Para publicação imediata,
     * enviamos a data/hora atual.
     */

    const agora = new Date();

    const dataAtual =
      agora.toISOString()
        .slice(0, 10);

    const horaAtual =
      agora.toTimeString()
        .slice(0, 5);


    const dataHora =
      `${dataAtual}T${horaAtual}`;


    formData.append(
      "dataHora",
      dataHora
    );


    const resposta =
      await fetch(
        "http://localhost:3000/publicacoes",
        {
          method: "POST",
          body: formData
        }
      );


    const resultado =
      await resposta.json();


    if (
      !resposta.ok ||
      !resultado.sucesso
    ) {

      throw new Error(
        resultado.mensagem ||
        "Não foi possível publicar."
      );

    }


    sucesso.value = true;

    mensagem.value =
      "Publicação realizada com sucesso!";


  } catch (erro) {

    sucesso.value = false;

    mensagem.value =
      erro.message ||
      "Ocorreu um erro ao publicar.";

  } finally {

    enviando.value = false;

  }

}


/* =====================================================
   AGENDAR PUBLICAÇÃO
===================================================== */

async function agendarPublicacao() {

  if (
    !podeAgendar.value ||
    enviando.value
  ) {
    return;
  }


  enviando.value = true;

  mensagem.value = "";


  try {

    const formData =
      new FormData();


    formData.append(
      "imagem",
      imagem.value
    );


    formData.append(
      "texto",
      texto.value
    );


    const dataHora =
      `${dataSelecionada.value}T${horaSelecionada.value}`;


    formData.append(
      "dataHora",
      dataHora
    );


    const resposta =
      await fetch(
        "http://localhost:3000/publicacoes",
        {
          method: "POST",
          body: formData
        }
      );


    const resultado =
      await resposta.json();


    if (
      !resposta.ok ||
      !resultado.sucesso
    ) {

      throw new Error(
        resultado.mensagem ||
        "Não foi possível agendar."
      );

    }


    sucesso.value = true;

    mensagem.value =
      resultado.mensagem ||
      "Publicação agendada com sucesso!";


  } catch (erro) {

    sucesso.value = false;

    mensagem.value =
      erro.message ||
      "Ocorreu um erro ao agendar.";

  } finally {

    enviando.value = false;

  }

}


/* =====================================================
   LIMPAR PREVIEW
===================================================== */

onUnmounted(() => {

  if (previewUrl.value) {

    URL.revokeObjectURL(
      previewUrl.value
    );

  }

});

</script>


<style scoped>

/* =====================================================
   RESET
===================================================== */

* {
  box-sizing: border-box;
}

:global(html),
:global(body),
:global(#app) {

  width: 100%;
  min-width: 100%;
  min-height: 100vh;

  margin: 0;
  padding: 0;

}

:global(body) {

  overflow-x: hidden;

}


/* =====================================================
   APP
===================================================== */

.app {

  width: 100%;
  min-width: 100vw;
  min-height: 100vh;

  background: #fafafa;

  color: #262626;

  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Helvetica,
    Arial,
    sans-serif;

  display: flex;

}


/* =====================================================
   SIDEBAR
===================================================== */

.sidebar {

  width: 230px;
  min-width: 230px;

  height: 100vh;

  position: fixed;

  left: 0;
  top: 0;

  background: #ffffff;

  border-right: 1px solid #dbdbdb;

  padding: 28px 14px;

  display: flex;

  flex-direction: column;

  z-index: 20;

}


.logo {

  display: flex;

  align-items: center;

  gap: 10px;

  padding: 8px 12px 38px;

  font-size: 21px;

  font-weight: 700;

}


.logo-icon {

  width: 34px;
  height: 34px;

  border-radius: 10px;

  display: flex;

  align-items: center;
  justify-content: center;

  color: #ffffff;

  background:
    linear-gradient(
      135deg,
      #feda75,
      #fa7e1e,
      #d62976,
      #962fbf,
      #4f5bd5
    );

  font-size: 23px;

}


.menu {

  display: flex;

  flex-direction: column;

  gap: 4px;

}


.menu-item {

  width: 100%;

  border: none;

  background: transparent;

  color: #262626;

  padding: 13px 14px;

  border-radius: 10px;

  display: flex;

  align-items: center;

  gap: 15px;

  font-size: 15px;

  text-align: left;

  cursor: pointer;

}


.menu-item:hover {

  background: #f5f5f5;

}


.menu-item.active {

  background: #f0f0f0;

  font-weight: 700;

}


.menu-icon {

  width: 24px;

  display: flex;

  align-items: center;
  justify-content: center;

  font-size: 21px;

}


/* =====================================================
   CONTEÚDO
===================================================== */

.content {

  width: calc(100vw - 230px);

  min-width: 0;

  min-height: 100vh;

  margin-left: 230px;

  padding: 45px 50px;

  background: #fafafa;

}


.topbar {

  width: 100%;

  max-width: 850px;

  margin: 0 auto 30px;

}


.topbar h1 {

  margin: 0;

  font-size: 26px;

  font-weight: 700;

}


.topbar p {

  margin: 6px 0 0;

  color: #737373;

  font-size: 13px;

}


/* =====================================================
   ÁREA
===================================================== */

.create-area {

  width: 100%;

  max-width: 850px;

  margin: 0 auto;

}


/* =====================================================
   CARD
===================================================== */

.publication-card {

  width: 100%;

  background: #ffffff;

  border: 1px solid #dbdbdb;

  border-radius: 14px;

  padding: 24px;

  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.025);

}


/* =====================================================
   UPLOAD
===================================================== */

.upload-area {

  width: 100%;

  height: 330px;

  position: relative;

  overflow: hidden;

  border: 1.5px dashed #c8c8c8;

  border-radius: 10px;

  background: #fafafa;

  display: flex;

  flex-direction: column;

  align-items: center;

  justify-content: center;

  cursor: pointer;

}


.upload-area:hover {

  border-color: #999999;

  background: #f7f7f7;

}


.upload-icon {

  width: 58px;
  height: 58px;

  border-radius: 50%;

  background: #262626;

  color: #ffffff;

  display: flex;

  align-items: center;
  justify-content: center;

  font-size: 32px;

  margin-bottom: 15px;

}


.upload-area h3 {

  margin: 0 0 6px;

  font-size: 16px;

}


.upload-area p {

  margin: 0;

  color: #737373;

  font-size: 13px;

}


.formats {

  margin-top: 10px;

  color: #aaaaaa;

  font-size: 11px;

}


.preview {

  width: 100%;
  height: 100%;

  object-fit: contain;

  background: #111111;

}


.change-image {

  position: absolute;

  left: 50%;
  bottom: 15px;

  transform: translateX(-50%);

  padding: 8px 14px;

  border-radius: 20px;

  background: rgba(0, 0, 0, 0.72);

  color: #ffffff;

  font-size: 11px;

}


/* =====================================================
   CAMPOS
===================================================== */

.field {

  margin-top: 20px;

}


.field-header {

  display: flex;

  align-items: center;

  justify-content: space-between;

}


.field label {

  display: block;

  margin-bottom: 7px;

  font-size: 13px;

  font-weight: 600;

}


.field-header label {

  margin-bottom: 7px;

}


.field-header span {

  color: #777777;

  font-size: 11px;

}


/* =====================================================
   TEXTAREA
===================================================== */

textarea {

  width: 100%;

  height: 100px;

  padding: 12px;

  resize: vertical;

  border: 1px solid #dbdbdb;

  border-radius: 8px;

  background: #ffffff;

  color: #262626;

  caret-color: #262626;

  outline: none;

  font-family: inherit;

  font-size: 13px;

  line-height: 1.5;

}


textarea:focus {

  border-color: #999999;

}


textarea::placeholder {

  color: #999999;

}


/* =====================================================
   BOTÃO PUBLICAR AGORA
===================================================== */

.publish-button {

  width: 100%;

  height: 43px;

  margin-top: 20px;

  border: none;

  border-radius: 8px;

  color: #ffffff;

  font-size: 13px;

  font-weight: 700;

  background:
    linear-gradient(
      90deg,
      #d62976,
      #962fbf
    );

  cursor: pointer;

  transition: 0.2s;

}


.publish-button:hover:not(:disabled) {

  transform: translateY(-1px);

  box-shadow:
    0 5px 15px rgba(150, 47, 191, 0.2);

}


.publish-button:disabled {

  background: #d6d6d6;

  cursor: not-allowed;

}


/* =====================================================
   OPÇÃO DE AGENDAMENTO
===================================================== */

.schedule-option {

  margin-top: 18px;

  padding-top: 16px;

  border-top: 1px solid #eeeeee;

}


.schedule-label {

  display: flex;

  align-items: center;

  justify-content: space-between;

  cursor: pointer;

  font-size: 13px;

  font-weight: 600;

}


.schedule-label input {

  display: none;

}


/* SWITCH */

.switch {

  width: 40px;

  height: 22px;

  position: relative;

  border-radius: 20px;

  background: #d1d1d1;

  transition: 0.2s;

}


.switch::after {

  content: "";

  width: 18px;

  height: 18px;

  position: absolute;

  top: 2px;

  left: 2px;

  border-radius: 50%;

  background: #ffffff;

  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.2);

  transition: 0.2s;

}


/* SWITCH ATIVO */

.schedule-label input:checked + .switch {

  background:
    linear-gradient(
      90deg,
      #d62976,
      #962fbf
    );

}


.schedule-label input:checked + .switch::after {

  transform: translateX(18px);

}


/* =====================================================
   CAMPOS DE AGENDAMENTO
===================================================== */

.schedule-fields {

  display: grid;

  grid-template-columns: 1fr 1fr;

  gap: 16px;

  margin-top: 18px;

}


.schedule-fields .field {

  margin-top: 0;

}


.input-with-icon {

  position: relative;

}


.datetime {

  width: 100%;

  height: 42px;

  padding: 0 40px 0 12px;

  border: 1px solid #dbdbdb;

  border-radius: 8px;

  background: #ffffff;

  color: #262626;

  outline: none;

  font-family: inherit;

  font-size: 13px;

  color-scheme: light;

  cursor: pointer;

}


.datetime:focus {

  border-color: #999999;

}


.calendar-icon,
.clock-icon {

  position: absolute;

  right: 12px;

  top: 50%;

  transform: translateY(-50%);

  color: #666666;

  pointer-events: none;

}


.datetime::-webkit-calendar-picker-indicator {

  position: absolute;

  right: 10px;

  opacity: 0;

  width: 25px;

  height: 25px;

  cursor: pointer;

}


/* =====================================================
   BOTÃO AGENDAR
===================================================== */

.schedule-button {

  width: 100%;

  height: 42px;

  margin-top: 18px;

  border: 1px solid #dbdbdb;

  border-radius: 8px;

  background: #ffffff;

  color: #262626;

  font-size: 13px;

  font-weight: 700;

  cursor: pointer;

  transition: 0.2s;

}


.schedule-button:hover:not(:disabled) {

  background: #f5f5f5;

}


.schedule-button:disabled {

  color: #999999;

  background: #f5f5f5;

  cursor: not-allowed;

}


/* =====================================================
   MENSAGEM
===================================================== */

.message {

  margin-top: 18px;

  padding: 11px 13px;

  border-radius: 8px;

  font-size: 12px;

}


.message.success {

  color: #16803c;

  background: #ecfdf3;

  border: 1px solid #bbf7d0;

}


.message.error {

  color: #d92d20;

  background: #fff1f2;

  border: 1px solid #fecdd3;

}


/* =====================================================
   RESPONSIVO
===================================================== */

@media (max-width: 700px) {

  .sidebar {

    width: 68px;

    min-width: 68px;

    padding: 20px 8px;

  }


  .logo {

    justify-content: center;

  }


  .logo span:last-child {

    display: none;

  }


  .menu-item {

    justify-content: center;

  }


  .menu-item span:last-child {

    display: none;

  }


  .content {

    width: calc(100vw - 68px);

    margin-left: 68px;

    padding: 30px 15px;

  }


  .publication-card {

    padding: 18px;

  }


  .upload-area {

    height: 280px;

  }


  .schedule-fields {

    grid-template-columns: 1fr;

    gap: 0;

  }


  .schedule-fields .field + .field {

    margin-top: 20px;

  }

}

</style>