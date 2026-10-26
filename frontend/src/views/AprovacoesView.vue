<!--
  Aprovações (cliente): publicações agendadas nos perfis do cliente.

  - Pendentes: deferir, indeferir (com motivo) ou deferir várias de uma vez.
    Sem resposta até o horário, o post NÃO é publicado (prazo esgotado).
  - Respondidas: a resposta dada (pelo cliente ou pela equipe em nome dele)
    e "Mudar para deferida/indeferida" até o horário da publicação.

  Tudo é filtrado no backend pelo cliente da sessão.
-->
<template>
  <div class="page">
    <div class="page-header">
      <h1>Aprovações</h1>
      <p>Confira os posts programados para você. Só é publicado o que você deferir até o horário.</p>
    </div>

    <nav class="abas" role="tablist">
      <button type="button" role="tab" :aria-selected="aba === 'pendentes'" :class="{ ativa: aba === 'pendentes' }" @click="aba = 'pendentes'">
        Pendentes <span class="contagem" :class="{ rosa: dados.pendentes.length > 0 }">{{ dados.pendentes.length }}</span>
      </button>
      <button type="button" role="tab" :aria-selected="aba === 'respondidas'" :class="{ ativa: aba === 'respondidas' }" @click="aba = 'respondidas'">
        Respondidas <span class="contagem">{{ dados.respondidas.length }}</span>
      </button>
    </nav>

    <p v-if="aviso.texto" class="alerta" :class="`alerta--${aviso.tipo}`" role="status">{{ aviso.texto }}</p>

    <div v-if="carregando" class="cartao estado-vazio">Carregando...</div>

    <div v-else-if="erro" class="cartao estado-vazio">
      <strong>Não foi possível carregar as aprovações</strong>
      <span>{{ erro }}</span>
      <button class="botao botao--secundario botao--pequeno" type="button" @click="carregar">Tentar novamente</button>
    </div>

    <!-- =========================== Pendentes =========================== -->
    <template v-else-if="aba === 'pendentes'">
      <div v-if="dados.pendentes.length === 0" class="cartao estado-vazio">
        <strong>Nada para aprovar agora</strong>
        <span>Quando a equipe programar um post nos seus perfis, ele aparece aqui.</span>
      </div>

      <template v-else>
        <div class="barra-lote" :class="{ ativa: selecionadas.length > 0 }">
          <label class="marcar-todas">
            <input
              type="checkbox"
              :checked="selecionadas.length === dados.pendentes.length"
              :indeterminate.prop="selecionadas.length > 0 && selecionadas.length < dados.pendentes.length"
              :disabled="ocupado"
              @change="selecionarTodas($event.target.checked)"
            />
            <span v-if="selecionadas.length"><strong>{{ selecionadas.length }} selecionada(s)</strong> de {{ dados.pendentes.length }}</span>
            <span v-else>Selecionar todas</span>
          </label>
          <span class="espaco"></span>
          <template v-if="selecionadas.length">
            <button class="botao botao--secundario botao--pequeno limpar" type="button" :disabled="ocupado" @click="selecionadas = []">Limpar seleção</button>
            <button class="botao botao--pequeno botao--deferir" type="button" :disabled="ocupado" @click="deferirSelecionadas">
              {{ ocupado === "lote" ? "Deferindo..." : "✓ Deferir selecionadas" }}
            </button>
          </template>
        </div>

        <div class="lista">
          <article v-for="p in dados.pendentes" :key="p.id" class="card" :class="{ selecionado: selecionadas.includes(p.id) }">
            <input v-model="selecionadas" class="marcar" type="checkbox" :value="p.id" :disabled="ocupado" :aria-label="`Selecionar post de ${formatarData(p.data_hora)}`" />
            <div class="imagem"><img v-if="p.imagem" :src="p.imagem" alt="" /></div>
            <div class="conteudo">
              <h3>@{{ p.username }}</h3>
              <p class="info">Programado para <strong>{{ formatarData(p.data_hora) }}</strong></p>
              <p class="legenda">{{ p.texto }}</p>
            </div>
            <div class="lado">
              <div class="prazo">
                <strong>{{ prazo(p.data_hora) }}</strong>
                Sem resposta até {{ formatarData(p.data_hora) }}, o post <strong class="nao-publica">não é publicado</strong>.
              </div>
              <button class="botao botao--deferir" type="button" :disabled="ocupado" @click="deferir(p)">
                {{ ocupado === p.id ? "Deferindo..." : "✓ Deferir" }}
              </button>
              <button class="botao botao--perigo" type="button" :disabled="ocupado" @click="indeferindo = p">✕ Indeferir</button>
            </div>
          </article>
        </div>
      </template>
    </template>

    <!-- ========================== Respondidas ========================== -->
    <template v-else>
      <div v-if="dados.respondidas.length === 0" class="cartao estado-vazio">
        <strong>Nenhuma resposta ainda</strong>
        <span>Os posts que você deferir ou indeferir aparecem aqui.</span>
      </div>

      <div v-else class="lista">
        <article v-for="p in dados.respondidas" :key="p.id" class="card respondida">
          <div class="imagem"><img v-if="p.imagem" :src="p.imagem" alt="" /></div>
          <div class="conteudo">
            <h3>@{{ p.username }}</h3>
            <p class="info">Programado para <strong>{{ formatarData(p.data_hora) }}</strong></p>
            <p class="legenda">{{ p.texto }}</p>
          </div>
          <div class="lado">
            <div v-if="p.status === 'recusada' && p.aprovacao === APROVACAO.PENDENTE" class="resposta cancelada">
              <strong>⏱ Prazo esgotado</strong>
              Não houve resposta até {{ formatarData(p.data_hora) }} · não foi publicada.
            </div>
            <div v-else-if="p.status === 'cancelada'" class="resposta cancelada">
              <strong>⊘ Cancelada pela equipe</strong>
              {{ p.cancelada_por_nome ? `${p.cancelada_por_nome} · ` : "" }}{{ formatarData(p.cancelada_em) }} · não será publicada.
            </div>
            <div v-else class="resposta" :class="p.aprovacao === APROVACAO.DEFERIDA ? 'ok' : 'nao'">
              <strong>{{ tituloResposta(p) }}</strong>
              {{ detalheResposta(p) }}
              <span v-if="p.aprovacao === APROVACAO.INDEFERIDA && p.aprovacao_motivo" class="motivo">“{{ p.aprovacao_motivo }}”</span>
            </div>
            <template v-if="p.podeMudar">
              <button
                class="botao botao--secundario"
                type="button"
                :disabled="ocupado"
                @click="p.aprovacao === APROVACAO.DEFERIDA ? (indeferindo = p) : deferir(p)"
              >
                {{ ocupado === p.id ? "Salvando..." : p.aprovacao === APROVACAO.DEFERIDA ? "Mudar para indeferida" : "Mudar para deferida" }}
              </button>
              <small class="nota">Você pode mudar até {{ formatarData(p.data_hora) }}.</small>
            </template>
            <small v-else-if="p.status !== 'cancelada'" class="nota">O horário já passou; a resposta não pode mais ser alterada.</small>
          </div>
        </article>
      </div>
    </template>

    <ModalIndeferir
      v-if="indeferindo"
      :publicacao="indeferindo"
      :enviar="(dadosMotivo) => responderAprovacao(indeferindo.id, { decisao: APROVACAO.INDEFERIDA, ...dadosMotivo })"
      @fechar="indeferindo = null"
      @concluido="aoIndeferir"
    />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";

import ModalIndeferir from "../components/publicacoes/ModalIndeferir.vue";
import { deferirVarias, listarAprovacoes, responderAprovacao } from "../api/minhaArea";
import { APROVACAO } from "../constants/publicacoes";
import { useAprovacoesPendentes } from "../composables/useAprovacoesPendentes";
import { formatarData } from "../utils/formatadores";

const contador = useAprovacoesPendentes();

const dados = reactive({ pendentes: [], respondidas: [] });
const carregando = ref(true);
const erro = ref("");
const aba = ref("pendentes");
const selecionadas = ref([]);
const indeferindo = ref(null);
/** `false`, o id da publicação em andamento, ou "lote". */
const ocupado = ref(false);
const aviso = reactive({ tipo: "", texto: "" });

function avisar(tipo, texto) {
  aviso.tipo = tipo;
  aviso.texto = texto;
  if (texto) setTimeout(() => { if (aviso.texto === texto) aviso.texto = ""; }, 6000);
}

async function carregar({ silencioso = false } = {}) {
  if (!silencioso) carregando.value = true;
  erro.value = "";
  try {
    const r = await listarAprovacoes();
    dados.pendentes = r.pendentes;
    dados.respondidas = r.respondidas;
    selecionadas.value = selecionadas.value.filter((id) => r.pendentes.some((p) => p.id === id));
    contador.definir(r.pendentes.length);
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
}

/* -------------------------------- formatos -------------------------------- */

function prazo(dataHora) {
  const horas = (new Date(dataHora).getTime() - Date.now()) / 36e5;
  if (horas < 1) return "Responda em menos de 1 hora";
  if (horas < 24) return `Responda em ${Math.floor(horas)} hora(s)`;
  const dias = Math.floor(horas / 24);
  return `Responda em ${dias} dia${dias > 1 ? "s" : ""}`;
}

function tituloResposta(p) {
  const deferida = p.aprovacao === APROVACAO.DEFERIDA;
  const quem = p.aprovacao_pela_equipe ? "pela equipe" : "por você";
  return `${deferida ? "✓ Deferida" : "✕ Indeferida"} ${quem}`;
}

function detalheResposta(p) {
  const quando = formatarData(p.aprovacao_em);
  const autor = p.aprovacao_pela_equipe && p.aprovacao_por_nome ? `${p.aprovacao_por_nome} · ` : "";
  const efeito = p.aprovacao === APROVACAO.DEFERIDA
    ? (p.status === "publicada" ? "publicada." : "será publicada no horário.")
    : "não será publicada.";
  return `${autor}${quando} · ${efeito}`;
}

/* --------------------------------- ações --------------------------------- */

async function deferir(p) {
  ocupado.value = p.id;
  try {
    await responderAprovacao(p.id, { decisao: APROVACAO.DEFERIDA });
    avisar("sucesso", `Post de @${p.username} deferido. Ele será publicado em ${formatarData(p.data_hora)}.`);
    await carregar({ silencioso: true });
  } catch (e) {
    avisar("erro", e.message || "Não foi possível deferir.");
    await carregar({ silencioso: true });
  } finally {
    ocupado.value = false;
  }
}

async function aoIndeferir() {
  const p = indeferindo.value;
  indeferindo.value = null;
  avisar("sucesso", `Post de @${p.username} indeferido. Ele não será publicado.`);
  await carregar({ silencioso: true });
}

function selecionarTodas(marcar) {
  selecionadas.value = marcar ? dados.pendentes.map((p) => p.id) : [];
}

async function deferirSelecionadas() {
  ocupado.value = "lote";
  try {
    const r = await deferirVarias(selecionadas.value);
    if (r.falhas?.length) {
      avisar("aviso", `${r.deferidas.length} deferida(s). ${r.falhas.length} não pôde(puderam) ser deferida(s): ${r.falhas[0].mensagem}`);
    } else {
      avisar("sucesso", `${r.deferidas.length} post(s) deferido(s).`);
    }
    selecionadas.value = [];
    await carregar({ silencioso: true });
  } catch (e) {
    avisar("erro", e.message || "Não foi possível deferir.");
  } finally {
    ocupado.value = false;
  }
}

onMounted(carregar);
</script>

<style scoped>
.abas {
  display: flex;
  gap: 26px;
  margin: -6px 0 18px;
  border-bottom: 1px solid #e5e5e5;
}

.abas button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 11px 0;
  border: 0;
  background: none;
  color: #777;
  font-size: 14px;
  cursor: pointer;
}

.abas button.ativa {
  color: #111;
  font-weight: 700;
  box-shadow: inset 0 -2px 0 var(--cor-primaria);
}

.contagem {
  padding: 1px 8px;
  border-radius: 10px;
  background: #eee;
  color: #555;
  font-size: 12px;
  font-weight: 600;
}

.contagem.rosa {
  background: #dd2a7b;
  color: #fff;
}

.alerta {
  margin-bottom: 14px;
}

.barra-lote {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  margin-bottom: 14px;
  padding: 8px 16px;
  border: 1px solid var(--cor-borda);
  border-radius: 10px;
  background: #fff;
  font-size: 13.5px;
}

.barra-lote.ativa {
  border-color: #252525;
  background: #252525;
  color: #fff;
}

.barra-lote.ativa .limpar {
  border-color: #666;
  background: transparent;
  color: #fff;
}

.marcar-todas {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.espaco {
  flex: 1;
}

.botao--deferir {
  border: 1px solid #1f7a3d;
  background: #1f7a3d;
  color: #fff;
}

.botao--deferir:hover:not(:disabled) {
  background: #18632f;
}

.lista {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.card {
  display: grid;
  grid-template-columns: 22px 170px minmax(0, 1fr) 250px;
  gap: 18px;
  align-items: start;
  padding: 16px;
  border: 1px solid var(--cor-borda);
  border-radius: 12px;
  background: #fff;
}

.card.respondida {
  grid-template-columns: 140px minmax(0, 1fr) 270px;
}

.card.selecionado {
  border-color: #252525;
  box-shadow: 0 0 0 1px #252525;
}

.marcar {
  width: 16px;
  height: 16px;
  margin-top: 4px;
  accent-color: var(--cor-primaria);
}

.marcar-todas input {
  width: 16px;
  height: 16px;
  accent-color: var(--cor-primaria);
}

.barra-lote.ativa .marcar-todas input {
  accent-color: #fff;
}

.imagem {
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 9px;
  background: #f2f2f2;
}

.imagem img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.conteudo {
  min-width: 0;
}

.conteudo h3 {
  margin: 2px 0 6px;
  font-size: 14.5px;
}

.info {
  margin: 0 0 12px;
  color: #777;
  font-size: 12.5px;
}

.legenda {
  margin: 0;
  color: #333;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.lado {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lado .botao {
  justify-content: center;
  width: 100%;
}

.prazo {
  padding: 11px 12px;
  border-radius: 8px;
  background: #fff6e0;
  color: #8a5a00;
  font-size: 12px;
  line-height: 1.5;
}

.prazo .nao-publica {
  display: inline;
  margin: 0;
  font-size: inherit;
}

.prazo strong {
  display: block;
  margin-bottom: 2px;
  font-size: 13px;
}

.resposta {
  padding: 12px;
  border-radius: 8px;
  font-size: 12.5px;
  line-height: 1.5;
}

.resposta strong {
  display: block;
  margin-bottom: 2px;
  font-size: 13.5px;
}

.resposta.cancelada {
  background: #f1f1f1;
  color: #555;
}

.resposta.ok {
  background: var(--cor-sucesso-fundo);
  color: var(--cor-sucesso-texto);
}

.resposta.nao {
  background: var(--cor-erro-fundo);
  color: var(--cor-erro-texto);
}

.motivo {
  display: block;
  margin-top: 6px;
  color: #7a2a22;
  font-style: italic;
}

.nota {
  color: #888;
  font-size: 11.5px;
  line-height: 1.4;
  text-align: center;
}

@media (max-width: 1000px) {
  .card,
  .card.respondida {
    grid-template-columns: 1fr;
  }

  .marcar {
    margin: 0;
  }

  .imagem {
    max-width: 220px;
  }
}

@media (max-width: 600px) {
  .abas {
    gap: 20px;
  }

  .barra-lote {
    flex-wrap: wrap;
    padding: 10px 12px;
  }

  .barra-lote .espaco {
    display: none;
  }

  .barra-lote .botao {
    flex: 1 1 auto;
  }

  .card,
  .card.respondida {
    position: relative;
    gap: 12px;
    padding: 14px;
  }

  /* Caixa de seleção sobre a imagem, no canto. */
  .marcar {
    position: absolute;
    top: 22px;
    left: 22px;
    z-index: 1;
    width: 20px;
    height: 20px;
  }

  .imagem {
    max-width: none;
    aspect-ratio: 4 / 3;
  }

  .lado .botao {
    padding: 12px;
  }
}
</style>
