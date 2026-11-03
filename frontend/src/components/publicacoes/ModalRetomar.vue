<!--
  Retomar um post que ficou SEM RESPOSTA até o horário (prazo esgotado):
  - acao "publicar": confirmação de "Publicar agora";
  - acao "agendar": escolhe data e horário (no mínimo 10 min à frente).

  Usado pelo cliente (Aprovações → Sem resposta) e pelo administrador
  (Postagens → ⋯, em nome do cliente).

  `enviar({ acao, dataHora? })` deve devolver uma Promise; o erro dela
  aparece dentro do modal. Ao concluir, emite `concluido` com
  `{ acao, dataHora }`.
-->
<template>
  <ModalBase
    :titulo="acao === 'publicar' ? 'Publicar agora' : 'Agendar publicação'"
    :subtitulo="subtitulo"
    :largura="560"
    :travada="enviando"
    @fechar="emit('fechar')"
  >
    <p v-if="erro" class="alerta alerta--erro">{{ erro }}</p>

    <div class="resumo-post">
      <div class="miniatura">
        <img v-if="publicacao.imagem" :src="publicacao.imagem" alt="" />
      </div>
      <div class="resumo-texto">
        <strong>@{{ publicacao.username }}</strong>
        <span>{{ publicacao.texto }}</span>
      </div>
    </div>

    <template v-if="acao === 'agendar'">
      <CampoAgendamento
        v-model:data="data"
        v-model:hora="hora"
        :data-minima="dataMinima"
        :desabilitado="enviando"
      />
      <small class="dica">No mínimo 10 minutos a partir de agora.</small>
      <p class="alerta alerta--info">
        Se mudar de ideia, dá para indeferir em "Aprovações → Respondidas" até o novo horário.
      </p>
    </template>

    <p v-else class="texto">
      O post sai <strong>agora</strong> em <strong>@{{ publicacao.username }}</strong>, com a mesma imagem e
      legenda. Leva cerca de 1 minuto; depois ele aparece em
      {{ pelaEquipe ? "Postagens" : "Minhas postagens" }}.
    </p>

    <template #rodape>
      <button class="botao botao--secundario" type="button" :disabled="enviando" @click="emit('fechar')">Voltar</button>
      <button
        class="botao"
        :class="acao === 'publicar' ? 'botao--publicar' : 'botao--primario'"
        type="button"
        :disabled="enviando || (acao === 'agendar' && !horarioValido)"
        @click="confirmar"
      >
        {{ textoBotao }}
      </button>
    </template>
  </ModalBase>
</template>

<script setup>
import { computed, ref } from "vue";

import CampoAgendamento from "./CampoAgendamento.vue";
import ModalBase from "../comum/ModalBase.vue";
import { dataDeHoje } from "../../utils/formatadores";

const props = defineProps({
  publicacao: { type: Object, required: true },
  /** "publicar" ou "agendar". */
  acao: { type: String, required: true },
  enviar: { type: Function, required: true },
  /** Administrador agindo em nome do cliente. */
  pelaEquipe: { type: Boolean, default: false },
});

const emit = defineEmits(["fechar", "concluido"]);

const ANTECEDENCIA_MS = 10 * 60 * 1000;

const data = ref("");
const hora = ref("");
const enviando = ref(false);
const erro = ref("");
const dataMinima = dataDeHoje();

/** Instante escolhido (fuso local do navegador), ou `null`. */
const instante = computed(() => {
  if (!data.value || !hora.value) return null;
  const d = new Date(`${data.value}T${hora.value}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
});

const horarioValido = computed(
  () => Boolean(instante.value) && instante.value.getTime() >= Date.now() + ANTECEDENCIA_MS
);

const subtitulo = computed(() => {
  const quem = props.pelaEquipe ? "em nome do cliente" : "por você";
  return props.acao === "publicar"
    ? `Este post ficou sem resposta até o horário. Publicando agora, ele fica registrado como deferido ${quem}.`
    : `Escolha quando o post deve sair. Ao agendar, ele já fica deferido ${quem} e é publicado no horário.`;
});

const textoBotao = computed(() => {
  if (enviando.value) return props.acao === "publicar" ? "Enviando..." : "Agendando...";
  if (props.acao === "publicar") return "▶ Publicar agora";
  if (!instante.value) return "🗓 Agendar";
  const quando = instante.value.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `🗓 Agendar para ${quando.replace(",", " às")}`;
});

async function confirmar() {
  erro.value = "";

  if (props.acao === "agendar" && !horarioValido.value) {
    erro.value = "Escolha um horário com pelo menos 10 minutos de antecedência.";
    return;
  }

  const dados =
    props.acao === "agendar"
      ? { acao: "agendar", dataHora: instante.value.toISOString() }
      : { acao: "publicar" };

  enviando.value = true;
  try {
    await props.enviar(dados);
    emit("concluido", dados);
  } catch (e) {
    erro.value = e.message || "Não foi possível concluir.";
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
  display: block;
  color: #222;
}

.resumo-texto span {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dica {
  margin-top: -8px;
  color: #888;
  font-size: 12px;
}

.alerta--info {
  background: #eef3ff;
  color: #2b4fae;
}

.texto {
  margin: 0;
  color: #444;
  font-size: 14px;
  line-height: 1.55;
}

.botao--publicar {
  border: 1px solid #1f7a3d;
  background: #1f7a3d;
  color: #fff;
}

.botao--publicar:hover:not(:disabled) {
  background: #18632f;
}
</style>
