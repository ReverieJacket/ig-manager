<!--
  Tela "Postagens": resumo por status, filtros, busca e tabela.
  A lógica de dados fica em `usePublicacoes`; aqui só há a composição.
-->
<template>
  <div class="page">
    <div class="page-header header-linha">
      <div>
        <h1>Postagens</h1>
        <p>Acompanhe as publicações e as respostas dos clientes.</p>
      </div>

      <router-link to="/criar" class="botao botao--primario create-button">
        <span>+</span>
        Criar
      </router-link>
    </div>

    <div v-if="perfisEmAtencao.length" class="alerta alerta--erro faixa-atencao" role="alert">
      <div>
        <strong>
          {{ perfisEmAtencao.length === 1 ? "1 perfil precisa ser reconectado" : `${perfisEmAtencao.length} perfis precisam ser reconectados` }}
        </strong>
        <span>
          A sessão do Instagram expirou e as publicações nesses perfis estão paradas:
          {{ perfisEmAtencao.map((p) => `@${p.username}${p.cliente ? ` (${p.cliente.nome})` : ""}`).join(", ") }}.
        </span>
      </div>
      <router-link to="/clientes" class="botao botao--secundario botao--pequeno">Ver em Clientes</router-link>
    </div>

    <ResumoPublicacoes :contagens="contagens" />

    <section class="cartao">
      <div class="posts-toolbar">
        <div class="tabs">
          <button
            v-for="aba in ABAS_FILTRO"
            :key="aba.valor"
            type="button"
            :class="{ selected: filtro === aba.valor }"
            @click="filtro = aba.valor"
          >
            {{ aba.rotulo }}
          </button>
        </div>

        <div class="toolbar-right">
          <select v-model="cliente" class="campo filtro-cliente" aria-label="Filtrar por cliente">
            <option value="">Todos os clientes</option>
            <option v-for="c in clientes" :key="c.id" :value="c.id">{{ c.nome }} ({{ c.total }})</option>
          </select>

          <input
            v-model="busca"
            class="campo"
            type="text"
            placeholder="Pesquisar..."
          />
        </div>
      </div>

      <div v-if="carregando" class="state">Carregando publicações...</div>

      <div v-else-if="erro" class="state">{{ erro }}</div>

      <div v-else-if="filtradas.length === 0" class="state">
        <strong>Nenhuma publicação encontrada.</strong>
        <span>
          Quando você criar ou agendar uma publicação, ela aparecerá aqui.
        </span>
      </div>

      <TabelaPublicacoes
        v-else
        :publicacoes="filtradas"
        @comentarios="publicacaoAberta = $event"
        @aprovacao="responderPeloClienteNaTela"
        @cancelar="abrirCancelar"
      />
    </section>

    <p v-if="aviso.texto" class="alerta toast" :class="`alerta--${aviso.tipo}`" role="status">{{ aviso.texto }}</p>

    <ModalIndeferir
      v-if="indeferindo"
      :publicacao="indeferindo"
      pela-equipe
      :enviar="(motivo) => responderPeloCliente(indeferindo.id, { decisao: APROVACAO.INDEFERIDA, ...motivo })"
      @fechar="indeferindo = null"
      @concluido="aoIndeferir"
    />

    <ModalBase
      v-if="deferindo"
      titulo="Deferir pelo cliente"
      :travada="salvandoDeferir"
      @fechar="deferindo = null"
    >
      <p v-if="erroDeferir" class="alerta alerta--erro">{{ erroDeferir }}</p>
      <p class="texto-modal">
        O post de <strong>@{{ deferindo.username }}</strong> será publicado em
        <strong>{{ formatarData(deferindo.data_hora) }}</strong>. Fica registrado que a equipe deferiu
        em nome do cliente (ex.: ele aprovou por WhatsApp). O cliente ainda pode mudar até o horário.
      </p>
      <template #rodape>
        <button class="botao botao--secundario" type="button" :disabled="salvandoDeferir" @click="deferindo = null">Cancelar</button>
        <button class="botao botao--primario" type="button" :disabled="salvandoDeferir" @click="confirmarDeferir">
          {{ salvandoDeferir ? "Deferindo..." : "✓ Deferir pelo cliente" }}
        </button>
      </template>
    </ModalBase>

    <ModalBase
      v-if="cancelando"
      titulo="Cancelar publicação"
      :travada="salvandoCancelar"
      @fechar="cancelando = null"
    >
      <p v-if="erroCancelar" class="alerta alerta--erro">{{ erroCancelar }}</p>
      <p class="texto-modal">
        O post de <strong>@{{ cancelando.username }}</strong> programado para
        <strong>{{ formatarData(cancelando.data_hora) }}</strong> <strong>não será publicado</strong>.
        Ele continua no histórico como "Cancelada" e o cliente vê que foi cancelado pela equipe.
      </p>
      <p class="texto-modal aviso-cancelar">Não dá para desfazer: para publicar depois, crie uma nova publicação.</p>
      <template #rodape>
        <button class="botao botao--secundario" type="button" :disabled="salvandoCancelar" @click="cancelando = null">Voltar</button>
        <button class="botao botao--perigo" type="button" :disabled="salvandoCancelar" @click="confirmarCancelar">
          {{ salvandoCancelar ? "Cancelando..." : "Cancelar publicação" }}
        </button>
      </template>
    </ModalBase>

    <ModalComentarios
      :publicacao="publicacaoAberta"
      @fechar="publicacaoAberta = null"
      @atualizado="carregar({ silencioso: true })"
    />
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";

import ModalBase from "../components/comum/ModalBase.vue";
import ModalComentarios from "../components/publicacoes/ModalComentarios.vue";
import ModalIndeferir from "../components/publicacoes/ModalIndeferir.vue";
import { cancelarPublicacao, responderPeloCliente } from "../api/publicacoes";
import ResumoPublicacoes from "../components/publicacoes/ResumoPublicacoes.vue";
import TabelaPublicacoes from "../components/publicacoes/TabelaPublicacoes.vue";
import { ABAS_FILTRO, APROVACAO } from "../constants/publicacoes";
import { formatarData } from "../utils/formatadores";
import { useAlertasPerfis } from "../composables/useAlertasPerfis";
import { usePublicacoes } from "../composables/usePublicacoes";

const { carregando, erro, filtro, busca, cliente, clientes, filtradas, contagens, carregar } =
  usePublicacoes();

const { perfisEmAtencao, atualizar: atualizarAlertas } = useAlertasPerfis();
onMounted(() => atualizarAlertas({ forcar: true }));

/** Publicação cujos comentários estão abertos no modal (`null` = fechado). */
const publicacaoAberta = ref(null);

/* ---------------- resposta da aprovação em nome do cliente ---------------- */

const indeferindo = ref(null);
const deferindo = ref(null);
const salvandoDeferir = ref(false);
const erroDeferir = ref("");
const aviso = reactive({ tipo: "", texto: "" });

function avisar(tipo, texto) {
  aviso.tipo = tipo;
  aviso.texto = texto;
  setTimeout(() => { if (aviso.texto === texto) aviso.texto = ""; }, 5000);
}

function responderPeloClienteNaTela({ publicacao, decisao }) {
  erroDeferir.value = "";
  if (decisao === APROVACAO.INDEFERIDA) indeferindo.value = publicacao;
  else deferindo.value = publicacao;
}

async function confirmarDeferir() {
  salvandoDeferir.value = true;
  erroDeferir.value = "";
  try {
    await responderPeloCliente(deferindo.value.id, { decisao: APROVACAO.DEFERIDA });
    avisar("sucesso", `Deferida pelo cliente: @${deferindo.value.username} será publicada no horário.`);
    deferindo.value = null;
    await carregar({ silencioso: true });
  } catch (e) {
    erroDeferir.value = e.message || "Não foi possível deferir.";
  } finally {
    salvandoDeferir.value = false;
  }
}

/* -------------------------------- cancelar -------------------------------- */

const cancelando = ref(null);
const salvandoCancelar = ref(false);
const erroCancelar = ref("");

function abrirCancelar(publicacao) {
  erroCancelar.value = "";
  cancelando.value = publicacao;
}

async function confirmarCancelar() {
  salvandoCancelar.value = true;
  erroCancelar.value = "";
  try {
    await cancelarPublicacao(cancelando.value.id);
    avisar("sucesso", `Publicação de @${cancelando.value.username} cancelada.`);
    cancelando.value = null;
    await carregar({ silencioso: true });
  } catch (e) {
    erroCancelar.value = e.message || "Não foi possível cancelar.";
  } finally {
    salvandoCancelar.value = false;
  }
}

async function aoIndeferir() {
  const p = indeferindo.value;
  indeferindo.value = null;
  avisar("sucesso", `Indeferida pelo cliente: o post de @${p.username} não será publicado.`);
  await carregar({ silencioso: true });
}
</script>

<style scoped>
.page {
  width: 100%;
  max-width: 1150px;
  margin: 0 auto;
}

.header-linha {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.create-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 18px;
  text-decoration: none;
}

.create-button span {
  font-size: 19px;
}

.cartao {
  overflow: hidden;
}

.toast {
  position: fixed;
  right: 28px;
  bottom: 24px;
  z-index: 70;
  max-width: 420px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
}

.texto-modal {
  margin: 0;
  color: #444;
  font-size: 14px;
  line-height: 1.55;
}

.aviso-cancelar {
  margin-top: 10px;
  color: #777;
  font-size: 13px;
}

.faixa-atencao {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.faixa-atencao strong {
  display: block;
  margin-bottom: 2px;
}

.faixa-atencao .botao {
  flex: none;
  text-decoration: none;
}

.filtro-cliente {
  width: 190px;
  padding: 9px 11px;
  border-radius: 7px;
  background: #fff;
}

.posts-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 70px;
  padding: 0 18px;
  border-bottom: 1px solid #e5e5e5;
}

.tabs {
  display: flex;
  gap: 4px;
}

.tabs button {
  padding: 9px 11px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--cor-texto-suave);
  font-size: 13px;
  cursor: pointer;
}

.tabs button:hover {
  background: #f5f5f5;
}

.tabs button.selected {
  background: #eeeeee;
  color: var(--cor-texto);
  font-weight: 600;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.toolbar-right input.campo {
  width: 180px;
  padding: 9px 11px;
  border-radius: 7px;
}

.toolbar-right .botao {
  padding: 9px 13px;
  font-weight: 400;
  font-size: 13px;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 220px;
  color: var(--cor-texto-suave);
  font-size: 14px;
}

.state strong {
  color: #333;
}

@media (max-width: 950px) {
  .posts-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 15px;
  }

  .toolbar-right {
    width: 100%;
  }

  .toolbar-right .campo {
    flex: 1;
  }
}

@media (max-width: 600px) {
  .header-linha {
    flex-direction: column;
    gap: 18px;
  }

  .tabs {
    width: 100%;
    overflow-x: auto;
  }

  .tabs button {
    white-space: nowrap;
  }
}
</style>
