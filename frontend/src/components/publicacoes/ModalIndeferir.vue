<!--
  Modal "Indeferir publicação": motivo (chip) + explicação obrigatória.
  Usado pelo cliente (Aprovações) e pelo administrador ("Indeferir pelo
  cliente", em Postagens).

  `enviar({ categoria, motivo })` deve devolver uma Promise; o erro dela
  aparece dentro do modal. Ao concluir, emite `concluido`.
-->
<template>
  <ModalBase
    titulo="Indeferir publicação"
    :subtitulo="subtitulo"
    :largura="580"
    :travada="enviando"
    @fechar="emit('fechar')"
  >
    <p v-if="erro" class="alerta alerta--erro">{{ erro }}</p>

    <div class="resumo-post">
      <div class="miniatura">
        <img v-if="publicacao.imagem" :src="publicacao.imagem" alt="" />
      </div>
      <div class="resumo-texto">
        <strong>@{{ publicacao.username }}</strong> · {{ formatarData(publicacao.data_hora) }}
        <span>{{ publicacao.texto }}</span>
      </div>
    </div>

    <div class="grupo-campo">
      <label>{{ pelaEquipe ? "Motivo informado pelo cliente" : "Por que não publicar?" }} <span class="obrig">*</span></label>
      <div class="chips">
        <button
          v-for="c in CATEGORIAS_INDEFERIMENTO"
          :key="c.valor"
          type="button"
          class="chip"
          :class="{ selecionado: categoria === c.valor }"
          :disabled="enviando"
          @click="categoria = c.valor"
        >
          {{ c.rotulo }}
        </button>
      </div>
    </div>

    <div class="grupo-campo">
      <textarea
        v-model="motivo"
        class="campo"
        rows="4"
        maxlength="500"
        :disabled="enviando"
        :placeholder="pelaEquipe ? 'Ex.: Cliente pediu por WhatsApp para não publicar porque...' : 'Explique o que está errado ou por que não publicar.'"
      />
      <small :class="{ 'txt-erro': motivo.trim().length > 0 && motivo.trim().length < 10 }">
        Obrigatório · mínimo de 10 caracteres ({{ motivo.trim().length }}/500)
      </small>
    </div>

    <template #rodape>
      <button class="botao botao--secundario" type="button" :disabled="enviando" @click="emit('fechar')">Voltar</button>
      <button class="botao botao--perigo" type="button" :disabled="!valido || enviando" @click="confirmar">
        {{ enviando ? "Indeferindo..." : "Indeferir publicação" }}
      </button>
    </template>
  </ModalBase>
</template>

<script setup>
import { computed, ref } from "vue";

import ModalBase from "../comum/ModalBase.vue";
import { CATEGORIAS_INDEFERIMENTO } from "../../constants/publicacoes";
import { formatarData } from "../../utils/formatadores";

const props = defineProps({
  publicacao: { type: Object, required: true },
  enviar: { type: Function, required: true },
  /** Administrador respondendo em nome do cliente. */
  pelaEquipe: { type: Boolean, default: false },
});

const emit = defineEmits(["fechar", "concluido"]);

const categoria = ref("");
const motivo = ref("");
const enviando = ref(false);
const erro = ref("");

const valido = computed(() => Boolean(categoria.value) && motivo.value.trim().length >= 10);

const subtitulo = computed(() => {
  const ate = formatarData(props.publicacao.data_hora);
  return props.pelaEquipe
    ? `O post não será publicado e fica registrado que a equipe indeferiu em nome do cliente. Dá para deferir de novo até ${ate}.`
    : `O post não será publicado e a equipe verá o seu motivo. Se mudar de ideia, dá para deferir até ${ate}.`;
});

async function confirmar() {
  enviando.value = true;
  erro.value = "";
  try {
    await props.enviar({ categoria: categoria.value, motivo: motivo.value.trim() });
    emit("concluido");
  } catch (e) {
    erro.value = e.message || "Não foi possível indeferir.";
  } finally {
    enviando.value = false;
  }
}
</script>

<style scoped>
.resumo-post {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 9px;
  color: #555;
  font-size: 12.5px;
}

.miniatura {
  flex: none;
  width: 56px;
  height: 56px;
  overflow: hidden;
  border-radius: 7px;
  background: #f2f2f2;
}

.miniatura img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.resumo-texto {
  min-width: 0;
}

.resumo-texto strong {
  color: #222;
}

.resumo-texto span {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.obrig {
  color: var(--cor-erro-texto);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 7px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: #fff;
  color: #333;
  font-size: 12.5px;
  cursor: pointer;
}

.chip.selecionado {
  border-color: var(--cor-primaria);
  background: var(--cor-primaria);
  color: #fff;
}

textarea.campo {
  min-height: 96px;
  padding: 11px 12px;
  line-height: 1.5;
  resize: vertical;
}

small {
  color: #888;
  font-size: 12px;
}

.txt-erro {
  color: var(--cor-erro-texto);
}
</style>
