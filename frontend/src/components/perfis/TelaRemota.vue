<!--
  Tela remota da conexão do Instagram: mostra o Instagram aberto (escondido)
  no computador do Publicador e envia para lá os toques, o texto e as teclas.
  Funciona no celular e no computador; ninguém precisa estar no computador do
  Publicador. A senha digitada vai direto para o Instagram e não é guardada.
-->
<template>
  <ModalBase
    :titulo="`Conectar @${username}`"
    subtitulo="Entre na conta do Instagram pela tela abaixo."
    :largura="480"
    @fechar="fechar"
  >
    <div class="tela-remota">
      <p class="situacao" :class="`situacao--${tipoSituacao}`">{{ textoSituacao }}</p>

      <div
        ref="moldura"
        class="moldura"
        tabindex="0"
        :style="{ aspectRatio: `${dimensao.w} / ${dimensao.h}` }"
        @keydown="aoTeclar"
        @wheel.prevent="aoRolar"
      >
        <img
          v-if="imagem"
          :src="imagem"
          alt="Tela do Instagram"
          draggable="false"
          @click="aoTocar"
        />
        <div v-else class="carregando">
          <span class="giro" aria-hidden="true"></span>
          <span>Abrindo o Instagram…</span>
        </div>
      </div>

      <form class="digitar" @submit.prevent="enviarTexto">
        <input
          v-model="texto"
          class="campo"
          :type="ocultar ? 'password' : 'text'"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Toque num campo acima e digite aqui"
          :disabled="!ativo"
        />
        <button class="botao botao--primario" type="submit" :disabled="!ativo || !texto">Enviar</button>
      </form>

      <div class="teclas">
        <label class="ocultar"><input v-model="ocultar" type="checkbox" /> Ocultar o que digito</label>
        <div>
          <button class="botao botao--secundario" type="button" :disabled="!ativo" @click="tecla('Backspace')">⌫ Apagar</button>
          <button class="botao botao--secundario" type="button" :disabled="!ativo" @click="tecla('Enter')">↵ Enter</button>
          <button class="botao botao--secundario" type="button" :disabled="!ativo" @click="rolar(400)">↓</button>
          <button class="botao botao--secundario" type="button" :disabled="!ativo" @click="rolar(-400)">↑</button>
        </div>
      </div>

      <p class="nota">
        Toque no campo do Instagram, digite na caixa acima e toque em <strong>Enviar</strong>. No
        computador também dá para clicar na tela e digitar direto. A senha não é guardada: só a
        sessão do Instagram, para publicar.
      </p>
    </div>

    <template #rodape>
      <button class="botao botao--secundario" type="button" @click="recarregar" :disabled="!ativo">Recarregar</button>
      <button class="botao botao--secundario" type="button" @click="cancelar">{{ concluido ? "Fechar" : "Cancelar" }}</button>
    </template>
  </ModalBase>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import ModalBase from "../comum/ModalBase.vue";
import { CanalRealtime } from "../../lib/canalRealtime";

const props = defineProps({
  /** `{ url, chave, canal }` devolvidos pelo site ao pedir a conexão. */
  remoto: { type: Object, required: true },
  username: { type: String, default: "" },
});

const emit = defineEmits(["fechar", "concluido"]);

const imagem = ref("");
const dimensao = ref({ w: 412, h: 800 });
const estado = ref({ status: "iniciando", mensagem: "Esperando o Publicador abrir o Instagram…" });
const conexaoCanal = ref("conectando");
const texto = ref("");
const ocultar = ref(true);
const moldura = ref(null);

let canal = null;
let ola = null;
let ultimoQuadro = 0;

const ativo = computed(() => Boolean(imagem.value) && !concluido.value);
const concluido = computed(() => ["conectado", "cancelado", "erro"].includes(estado.value.status));

const tipoSituacao = computed(() => {
  if (estado.value.status === "conectado") return "sucesso";
  if (["cancelado", "erro"].includes(estado.value.status)) return "erro";
  return "info";
});

const textoSituacao = computed(() => {
  if (conexaoCanal.value === "reconectando" && !concluido.value) return "Reconectando à tela…";
  return estado.value.mensagem;
});

function aoReceber(evento, dados) {
  if (evento === "quadro" && dados?.img) {
    if (dados.n && dados.n < ultimoQuadro) return;
    ultimoQuadro = dados.n || ultimoQuadro;
    imagem.value = `data:image/jpeg;base64,${dados.img}`;
    if (dados.w && dados.h) dimensao.value = { w: dados.w, h: dados.h };
    return;
  }
  if (evento === "estado" && dados?.status) {
    estado.value = dados;
    if (dados.status === "conectado") emit("concluido", dados);
  }
}

function enviar(evento, dados) {
  if (!concluido.value) canal?.enviar(evento, dados);
}

function aoTocar(evento) {
  const caixa = evento.currentTarget.getBoundingClientRect();
  enviar("clique", {
    x: (evento.clientX - caixa.left) / caixa.width,
    y: (evento.clientY - caixa.top) / caixa.height,
  });
  moldura.value?.focus({ preventScroll: true });
}

function aoRolar(evento) {
  rolar(Math.max(-800, Math.min(800, evento.deltaY)));
}

function rolar(dy) {
  enviar("rolar", { dy });
}

function tecla(nome) {
  enviar("tecla", { tecla: nome });
}

function enviarTexto() {
  if (!texto.value) return;
  enviar("texto", { texto: texto.value });
  texto.value = "";
}

/** No computador: digitar com a tela selecionada vai direto para o Instagram. */
const TECLAS = ["Enter", "Backspace", "Tab", "Escape", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
function aoTeclar(evento) {
  if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
  if (TECLAS.includes(evento.key)) {
    evento.preventDefault();
    tecla(evento.key);
  } else if (evento.key.length === 1) {
    evento.preventDefault();
    enviar("texto", { texto: evento.key });
  }
}

function recarregar() {
  enviar("recarregar", {});
}

function cancelar() {
  if (!concluido.value) canal?.enviar("cancelar", {});
  fechar();
}

function fechar() {
  emit("fechar");
}

onMounted(async () => {
  canal = new CanalRealtime({
    ...props.remoto,
    aoReceber,
    aoMudarEstado: (e) => {
      conexaoCanal.value = e;
      if (e === "conectado") canal.enviar("ola", {});
    },
  });
  try {
    await canal.conectar();
  } catch (e) {
    estado.value = { status: "erro", mensagem: e.message };
    return;
  }
  // Avisa o Publicador que há alguém olhando (ele reenvia a tela atual).
  ola = setInterval(() => {
    if (!imagem.value) canal?.enviar("ola", {});
  }, 2000);
});

onBeforeUnmount(() => {
  clearInterval(ola);
  canal?.fechar();
});
</script>

<style scoped>
.tela-remota {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.situacao {
  margin: 0;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.situacao--info {
  background: #eef4ff;
  color: #1e3a8a;
}

.situacao--sucesso {
  background: #ecfdf3;
  color: #166534;
}

.situacao--erro {
  background: #fef2f2;
  color: #991b1b;
}

.moldura {
  position: relative;
  width: 100%;
  max-height: 62vh;
  margin: 0 auto;
  overflow: hidden;
  background: #111;
  border-radius: 12px;
  outline: none;
}

.moldura:focus-visible {
  box-shadow: 0 0 0 3px #93c5fd;
}

.moldura img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
}

.carregando {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #ddd;
  font-size: 14px;
}

.giro {
  width: 28px;
  height: 28px;
  border: 3px solid #555;
  border-top-color: #fff;
  border-radius: 50%;
  animation: girar 0.9s linear infinite;
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

.digitar {
  display: flex;
  gap: 8px;
}

.digitar .campo {
  flex: 1;
  min-width: 0;
}

.teclas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.teclas > div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ocultar {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--cor-texto-suave);
  font-size: 13px;
}

.nota {
  margin: 0;
  color: var(--cor-texto-suave);
  font-size: 12px;
  line-height: 1.45;
}
</style>
