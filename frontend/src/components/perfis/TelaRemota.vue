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
    :largura="460"
    @fechar="fechar"
  >
    <div class="tela-remota">
      <p class="situacao" :class="`situacao--${tipoSituacao}`">{{ textoSituacao }}</p>

      <ol v-if="!concluido" class="guia" aria-label="Como conectar">
        <li :class="{ feito: Boolean(imagem) }"><span>1</span>Toque no campo da <strong>senha</strong></li>
        <li><span>2</span>Digite no teclado que abrir</li>
        <li><span>3</span>Toque em <strong>Entrar</strong></li>
      </ol>

      <div
        ref="moldura"
        class="moldura"
        :style="{ aspectRatio: `${dimensao.w} / ${dimensao.h}` }"
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

      <label class="digitar" :class="{ 'digitar--ativo': digitando }">
        <span>{{ digitando ? "Digitando no Instagram" : "Toque num campo da tela acima para digitar" }}</span>
        <input
          ref="entrada"
          v-model="texto"
          class="campo"
          :type="ocultar ? 'password' : 'text'"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="go"
          :placeholder="digitando ? 'O que você digitar aqui vai direto para o campo' : ''"
          :disabled="!ativo"
          @input="aoDigitar"
          @keydown="aoTeclar"
          @focus="digitando = true"
          @blur="digitando = false"
        />
      </label>

      <div class="teclas">
        <label class="ocultar"><input v-model="ocultar" type="checkbox" /> Ocultar o que digito</label>
        <div>
          <button class="botao botao--secundario" type="button" :disabled="!ativo" @click="tecla('Backspace')">⌫</button>
          <button class="botao botao--primario" type="button" :disabled="!ativo" @click="tecla('Enter')">Entrar ↵</button>
        </div>
      </div>

      <p class="nota">
        Esta é a tela do Instagram, aberta para você com segurança. A sua senha vai direto para o
        Instagram e não é guardada. Se o Instagram pedir um código, ele chega no seu e-mail ou
        celular: digite-o do mesmo jeito.
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
const entrada = ref(null);
const digitando = ref(false);
/** O que já foi mandado para o campo do Instagram (para mandar só a diferença). */
let enviado = "";

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
  // Novo campo: começa do zero e abre o teclado (no celular, só dentro do toque).
  texto.value = "";
  enviado = "";
  entrada.value?.focus({ preventScroll: true });
}

/** Manda para o Instagram só o que mudou desde a última letra. */
function aoDigitar() {
  const novo = texto.value;
  let comum = 0;
  while (comum < novo.length && comum < enviado.length && novo[comum] === enviado[comum]) comum++;
  for (let i = enviado.length; i > comum; i--) tecla("Backspace");
  const acrescentado = novo.slice(comum);
  if (acrescentado) enviar("texto", { texto: acrescentado });
  enviado = novo;
}

const TECLAS_ESPECIAIS = ["Enter", "Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
function aoTeclar(evento) {
  if (TECLAS_ESPECIAIS.includes(evento.key)) {
    evento.preventDefault();
    tecla(evento.key);
    if (evento.key === "Enter") {
      texto.value = "";
      enviado = "";
    }
  } else if (evento.key === "Backspace" && !texto.value) {
    // Campo já tinha texto lá no Instagram: apaga de lá.
    tecla("Backspace");
  }
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

.guia {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
}

.guia li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.guia span {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #1d4ed8;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.digitar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--cor-texto-suave);
}

.digitar--ativo {
  color: #1d4ed8;
  font-weight: 600;
}

.digitar--ativo .campo {
  border-color: #1d4ed8;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.15);
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
