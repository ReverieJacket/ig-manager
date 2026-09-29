<!--
  Área de seleção de imagem com pré-visualização.
  Não valida o arquivo: emite `selecionar` e quem usa decide (ver
  `useFormularioPublicacao.escolherArquivo`).
-->
<template>
  <div
    class="upload-area"
    :class="{ 'has-image': previa, disabled: desabilitado }"
    @click="abrirSeletor"
  >
    <input
      ref="entrada"
      type="file"
      :accept="IMAGEM.tiposPermitidos.join(',')"
      hidden
      @change="aoSelecionar"
    />

    <template v-if="previa">
      <img :src="previa" class="preview" alt="Pré-visualização da publicação" />
      <span class="change-image">Clique para trocar a imagem</span>
    </template>

    <template v-else>
      <div class="upload-icon">+</div>
      <strong>Adicionar uma imagem</strong>
      <span>Clique para selecionar uma imagem</span>
      <small>
        JPG, PNG ou WEBP — máximo {{ IMAGEM.tamanhoMaximoMb }} MB
      </small>
    </template>
  </div>
</template>

<script setup>
import { ref } from "vue";

import { IMAGEM } from "../../constants/publicacoes";

/**
 * @property {string} previa - URL (blob:) da imagem escolhida, ou vazio.
 * @property {boolean} desabilitado - Bloqueia a troca durante o envio.
 * @event selecionar - Emitido com o `File` escolhido.
 */
const props = defineProps({
  previa: { type: String, default: "" },
  desabilitado: { type: Boolean, default: false },
});

const emit = defineEmits(["selecionar"]);

const entrada = ref(null);

function abrirSeletor() {
  if (!props.desabilitado) entrada.value?.click();
}

function aoSelecionar(evento) {
  const arquivo = evento.target.files?.[0];

  if (arquivo) emit("selecionar", arquivo);

  // Permite escolher o mesmo arquivo novamente depois de uma recusa.
  evento.target.value = "";
}
</script>

<style scoped>
.upload-area {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 330px;
  overflow: hidden;
  border: 1px dashed #ccc;
  border-radius: 9px;
  background: #fff;
  cursor: pointer;
  transition: background 0.15s ease;
}

.upload-area:hover {
  background: var(--cor-fundo);
}

.upload-area.has-image {
  border-style: solid;
  border-color: var(--cor-borda);
  background: #f8f8f8;
}

.upload-area.disabled {
  cursor: not-allowed;
}

.upload-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 59px;
  height: 59px;
  margin-bottom: 15px;
  border-radius: 50%;
  background: var(--cor-primaria);
  color: white;
  font-size: 30px;
  font-weight: 300;
}

.upload-area strong {
  margin-bottom: 7px;
  color: var(--cor-texto);
  font-size: 16px;
}

.upload-area span {
  margin-bottom: 10px;
  color: var(--cor-texto-suave);
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

@media (max-width: 650px) {
  .upload-area {
    height: 270px;
  }
}
</style>
