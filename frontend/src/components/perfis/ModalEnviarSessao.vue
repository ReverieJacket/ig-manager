<!--
  Enviar o arquivo de sessão do Instagram de um perfil (administrador).

  Para quando o backend roda num servidor sem tela (Oracle, EC2): o login
  no Instagram é feito no computador do administrador com
  `npm run login:instagram -- --conta <id>`, e o arquivo gerado
  (`backend/storage/instagram-sessoes/conta-<id>.json`) é enviado aqui.
-->
<template>
  <ModalBase
    titulo="Enviar sessão do Instagram"
    :subtitulo="`Conecta @${perfil.username} neste servidor usando o login feito no seu computador.`"
    :largura="600"
    :travada="enviando"
    @fechar="emit('fechar')"
  >
    <p v-if="erro" class="alerta alerta--erro">{{ erro }}</p>

    <ol class="passos">
      <li>
        No seu computador, na pasta do projeto, rode no terminal:
        <div class="caixa-copiar">
          <code>{{ comando }}</code>
          <button class="botao botao--secundario botao--pequeno" type="button" @click="copiar">
            {{ copiado ? "Copiado ✓" : "Copiar" }}
          </button>
        </div>
      </li>
      <li>Na janela do Chromium que abrir, entre no Instagram de <strong>@{{ perfil.username }}</strong> e espere a mensagem de sessão salva.</li>
      <li>
        Escolha o arquivo gerado:
        <code class="caminho">backend\storage\instagram-sessoes\conta-{{ perfil.id }}.json</code>
      </li>
    </ol>

    <label class="escolher" :class="{ escolhido: arquivo }">
      <input type="file" accept=".json,application/json" :disabled="enviando" @change="escolher" />
      <span v-if="arquivo">📄 {{ arquivo.name }}</span>
      <span v-else>Clique para escolher o arquivo <strong>conta-{{ perfil.id }}.json</strong></span>
    </label>

    <p v-if="arquivo && nomeDiferente" class="alerta alerta--aviso">
      O nome do arquivo não é <strong>conta-{{ perfil.id }}.json</strong>. Confira se é a sessão de @{{ perfil.username }} antes de enviar.
    </p>

    <p class="nota">
      🔒 Esse arquivo dá acesso à conta do Instagram. Ele vai direto para o servidor e não é mostrado em lugar
      nenhum. Depois de enviar, pode apagá-lo do seu computador, se quiser.
    </p>

    <template #rodape>
      <button class="botao botao--secundario" type="button" :disabled="enviando" @click="emit('fechar')">Cancelar</button>
      <button class="botao botao--primario" type="button" :disabled="!arquivo || enviando" @click="enviar">
        {{ enviando ? "Enviando..." : "⬆ Enviar sessão" }}
      </button>
    </template>
  </ModalBase>
</template>

<script setup>
import { computed, ref } from "vue";

import ModalBase from "../comum/ModalBase.vue";
import { enviarSessaoPerfil } from "../../api/perfis";

const props = defineProps({
  perfil: { type: Object, required: true },
});

const emit = defineEmits(["fechar", "concluido"]);

const arquivo = ref(null);
const enviando = ref(false);
const erro = ref("");
const copiado = ref(false);

const comando = computed(() => `npm run login:instagram -- --conta ${props.perfil.id}`);
const nomeDiferente = computed(() => arquivo.value && arquivo.value.name !== `conta-${props.perfil.id}.json`);

function escolher(evento) {
  erro.value = "";
  arquivo.value = evento.target.files?.[0] || null;
}

async function copiar() {
  try {
    await navigator.clipboard.writeText(comando.value);
    copiado.value = true;
    setTimeout(() => { copiado.value = false; }, 2000);
  } catch {
    copiado.value = false;
  }
}

async function enviar() {
  enviando.value = true;
  erro.value = "";
  try {
    const r = await enviarSessaoPerfil(props.perfil.id, arquivo.value);
    emit("concluido", r);
  } catch (e) {
    erro.value = e.message || "Não foi possível enviar a sessão.";
  } finally {
    enviando.value = false;
  }
}
</script>

<style scoped>
.passos {
  margin: 0;
  padding-left: 20px;
  color: #444;
  font-size: 13.5px;
  line-height: 1.6;
}

.passos li + li {
  margin-top: 8px;
}

.caixa-copiar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  padding: 9px 12px;
  border: 1.5px dashed #c9c9c9;
  border-radius: 9px;
  background: #fafafa;
}

.caixa-copiar code {
  flex: 1;
  overflow-wrap: anywhere;
  font-family: "DejaVu Sans Mono", Consolas, monospace;
  font-size: 12.5px;
}

.caminho {
  display: block;
  margin-top: 4px;
  overflow-wrap: anywhere;
  color: #555;
  font-family: "DejaVu Sans Mono", Consolas, monospace;
  font-size: 12px;
}

.escolher {
  display: block;
  padding: 18px 14px;
  border: 1.5px dashed #bbb;
  border-radius: 10px;
  color: #555;
  font-size: 13.5px;
  text-align: center;
  cursor: pointer;
}

.escolher:hover {
  border-color: #888;
}

.escolher.escolhido {
  border-style: solid;
  border-color: var(--cor-primaria);
  color: #222;
}

.escolher input {
  display: none;
}

.nota {
  margin: 0;
  color: #777;
  font-size: 12px;
  line-height: 1.5;
}
</style>
