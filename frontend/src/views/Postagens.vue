<template>
  <AppLayout>

    <div class="page">

      <!-- CABEÇALHO -->
      <div class="page-header">

        <div>
          <h1>Postagens</h1>

          <p>
            Acompanhe suas publicações do Instagram.
          </p>
        </div>

        <button
          class="create-button"
          @click="router.push('/criar')"
        >
          <span>+</span>
          Criar
        </button>

      </div>

      <!-- RESUMO -->
      <div class="summary-grid">

        <div class="summary-card">
          <span>Publicadas</span>
          <strong>{{ quantidadePublicadas }}</strong>
        </div>

        <div class="summary-card">
          <span>Agendadas</span>
          <strong>{{ quantidadeAgendadas }}</strong>
        </div>

        <div class="summary-card">
          <span>Rascunhos</span>
          <strong>{{ quantidadeRascunhos }}</strong>
        </div>

        <div class="summary-card">
          <span>Com erro</span>
          <strong>{{ quantidadeErros }}</strong>
        </div>

        <div class="summary-card">
          <span>Recusadas</span>
          <strong>{{ quantidadeRecusadas }}</strong>
        </div>

      </div>

      <!-- CARD PRINCIPAL -->
      <section class="posts-card">

        <!-- CONTROLES -->
        <div class="posts-toolbar">

          <div class="tabs">

            <button
              v-for="tab in tabs"
              :key="tab.value"
              :class="{ selected: filtro === tab.value }"
              @click="filtro = tab.value"
            >
              {{ tab.label }}
            </button>

          </div>

          <div class="toolbar-right">

            <input
              v-model="busca"
              type="text"
              placeholder="Pesquisar..."
            />

            <button class="filter-button">
              Filtros
            </button>

          </div>

        </div>

        <!-- CARREGANDO -->
        <div v-if="carregando" class="state">
          Carregando publicações...
        </div>

        <!-- ERRO -->
        <div v-else-if="erro" class="state error">
          {{ erro }}
        </div>

        <!-- VAZIO -->
        <div v-else-if="postsFiltrados.length === 0" class="state">

          <strong>Nenhuma publicação encontrada.</strong>

          <span>
            Quando você criar ou agendar uma publicação,
            ela aparecerá aqui.
          </span>

        </div>

        <!-- TABELA -->
        <div v-else class="table-wrapper">

          <table>

            <thead>
              <tr>
                <th>Imagem</th>
                <th>Legenda</th>
                <th>Conta</th>
                <th>Status</th>
                <th>Data/Hora</th>
                <th>Engajamento</th>
                <th>Cliente</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>

              <tr
                v-for="post in postsFiltrados"
                :key="post.id"
              >

                <td>
                  <div class="image-placeholder">
                    <img
                      v-if="post.imagem"
                      :src="post.imagem"
                      alt=""
                    />

                    <span v-else>
                      —
                    </span>
                  </div>
                </td>

                <td class="caption">
                  {{ post.texto || "Sem legenda" }}
                </td>

                <td>
                  {{ post.conta || post.username || "—" }}
                </td>

                <td>
                  <span
                    class="status"
                    :class="statusClass(post.status)"
                  >
                    {{ formatarStatus(post.status) }}
                  </span>
                </td>

                <td>
                  {{ formatarData(post.data_hora) }}
                </td>

                <td>
                  <div class="engagement">
                    <span>♡ {{ post.curtidas ?? 0 }}</span>
                    <span>◌ {{ post.comentarios ?? 0 }}</span>
                  </div>
                </td>

                <td>
                  {{ post.cliente || "—" }}
                </td>

                <td>
                  <button class="action-button">
                    ⋮
                  </button>
                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </section>

    </div>

  </AppLayout>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import AppLayout from "../components/AppLayout.vue";

const router = useRouter();

const posts = ref([]);
const carregando = ref(true);
const erro = ref("");
const busca = ref("");
const filtro = ref("TODAS");

const tabs = [
  {
    label: "Todas",
    value: "TODAS"
  },
  {
    label: "Publicadas",
    value: "PUBLICADA"
  },
  {
    label: "Agendadas",
    value: "AGENDADA"
  },
  {
    label: "Rascunhos",
    value: "RASCUNHO"
  },
  {
    label: "Com erro",
    value: "ERRO"
  },
  {
    label: "Recusadas",
    value: "RECUSADA"
  }
];

const postsFiltrados = computed(() => {

  let resultado = posts.value;

  if (filtro.value !== "TODAS") {
    resultado = resultado.filter(
      post => String(post.status).toUpperCase() === filtro.value
    );
  }

  if (busca.value.trim()) {

    const termo = busca.value.toLowerCase();

    resultado = resultado.filter(post => {

      return (
        String(post.texto || "")
          .toLowerCase()
          .includes(termo) ||

        String(post.conta || "")
          .toLowerCase()
          .includes(termo) ||

        String(post.username || "")
          .toLowerCase()
          .includes(termo)
      );

    });
  }

  return resultado;
});

const quantidadePublicadas = computed(() =>
  posts.value.filter(
    post => String(post.status).toUpperCase() === "PUBLICADA"
  ).length
);

const quantidadeAgendadas = computed(() =>
  posts.value.filter(
    post => String(post.status).toUpperCase() === "AGENDADA"
  ).length
);

const quantidadeRascunhos = computed(() =>
  posts.value.filter(
    post => String(post.status).toUpperCase() === "RASCUNHO"
  ).length
);

const quantidadeErros = computed(() =>
  posts.value.filter(
    post => String(post.status).toUpperCase() === "ERRO"
  ).length
);

const quantidadeRecusadas = computed(() =>
  posts.value.filter(
    post => String(post.status).toUpperCase() === "RECUSADA"
  ).length
);

function formatarStatus(status) {

  const valores = {
    PUBLICADA: "Publicada",
    AGENDADA: "Agendada",
    RASCUNHO: "Rascunho",
    ERRO: "Com erro",
    RECUSADA: "Recusada"
  };

  return valores[String(status).toUpperCase()] || status || "—";
}

function statusClass(status) {
  return String(status || "").toLowerCase();
}

function formatarData(data) {

  if (!data) {
    return "—";
  }

  const dataObj = new Date(data);

  if (Number.isNaN(dataObj.getTime())) {
    return "—";
  }

  return dataObj.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

async function carregarPublicacoes() {

  carregando.value = true;
  erro.value = "";

  try {

    const resposta = await fetch(
      "http://localhost:3000/publicacoes"
    );

    if (!resposta.ok) {
      throw new Error("Não foi possível carregar as publicações.");
    }

    posts.value = await resposta.json();

  } catch (error) {

    console.error(error);

    erro.value =
      "Não foi possível carregar as publicações. Verifique se o backend está funcionando.";

  } finally {

    carregando.value = false;

  }
}

onMounted(carregarPublicacoes);
</script>

<style scoped>

.page {
  width: 100%;
  max-width: 1150px;
  margin: 0 auto;
}

/* =========================
   CABEÇALHO
========================= */

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

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

.create-button {
  display: flex;
  align-items: center;
  gap: 8px;

  border: none;
  border-radius: 8px;

  padding: 11px 18px;

  background: #252525;
  color: white;

  font-family: inherit;
  font-size: 14px;
  font-weight: 600;

  cursor: pointer;
}

.create-button:hover {
  background: #111;
}

.create-button span {
  font-size: 19px;
}

/* =========================
   RESUMO
========================= */

.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);

  gap: 12px;

  margin-bottom: 18px;
}

.summary-card {
  background: white;

  border: 1px solid #dddddd;
  border-radius: 9px;

  padding: 17px 18px;
}

.summary-card span {
  display: block;

  color: #777;

  font-size: 12px;

  margin-bottom: 7px;
}

.summary-card strong {
  color: #222;

  font-size: 22px;
}

/* =========================
   CARD POSTAGENS
========================= */

.posts-card {
  background: white;

  border: 1px solid #dddddd;
  border-radius: 10px;

  overflow: hidden;
}

/* =========================
   TOOLBAR
========================= */

.posts-toolbar {
  min-height: 70px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 0 18px;

  border-bottom: 1px solid #e5e5e5;
}

.tabs {
  display: flex;
  gap: 4px;
}

.tabs button {
  border: none;
  background: transparent;

  padding: 9px 11px;

  border-radius: 7px;

  color: #777;

  font-family: inherit;
  font-size: 13px;

  cursor: pointer;
}

.tabs button:hover {
  background: #f5f5f5;
}

.tabs button.selected {
  background: #eeeeee;

  color: #222;

  font-weight: 600;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.toolbar-right input {
  width: 180px;

  padding: 9px 11px;

  border: 1px solid #d8d8d8;
  border-radius: 7px;

  outline: none;

  font-family: inherit;
  font-size: 13px;
}

.toolbar-right input:focus {
  border-color: #aaa;
}

.filter-button {
  border: 1px solid #d8d8d8;

  background: white;

  border-radius: 7px;

  padding: 9px 13px;

  color: #444;

  font-family: inherit;
  font-size: 13px;

  cursor: pointer;
}

/* =========================
   TABELA
========================= */

.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;

  min-width: 900px;
}

th {
  background: #fafafa;

  color: #777;

  text-align: left;

  font-size: 11px;
  font-weight: 600;

  padding: 13px 15px;

  border-bottom: 1px solid #e5e5e5;
}

td {
  padding: 14px 15px;

  color: #333;

  font-size: 13px;

  border-bottom: 1px solid #eeeeee;
}

tr:last-child td {
  border-bottom: none;
}

/* =========================
   IMAGEM
========================= */

.image-placeholder {
  width: 48px;
  height: 48px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 6px;

  background: #f2f2f2;

  overflow: hidden;
}

.image-placeholder img {
  width: 100%;
  height: 100%;

  object-fit: cover;
}

/* =========================
   LEGENDA
========================= */

.caption {
  max-width: 220px;

  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* =========================
   STATUS
========================= */

.status {
  display: inline-flex;

  padding: 5px 8px;

  border-radius: 6px;

  font-size: 11px;
  font-weight: 600;
}

.status.publicada {
  background: #eeeeee;
  color: #333;
}

.status.agendada {
  background: #f5f5f5;
  color: #555;
}

.status.rascunho {
  background: #f0f0f0;
  color: #666;
}

.status.erro {
  background: #eeeeee;
  color: #444;
}

.status.recusada {
  background: #e9e9e9;
  color: #333;
}

/* =========================
   ENGAJAMENTO
========================= */

.engagement {
  display: flex;
  gap: 9px;

  color: #666;

  font-size: 12px;
}

/* =========================
   AÇÕES
========================= */

.action-button {
  border: none;
  background: transparent;

  color: #666;

  font-size: 18px;

  cursor: pointer;
}

/* =========================
   ESTADOS
========================= */

.state {
  min-height: 220px;

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  gap: 8px;

  color: #777;

  font-size: 14px;
}

.state strong {
  color: #333;
}

.state.error {
  color: #555;
}

/* =========================
   RESPONSIVO
========================= */

@media (max-width: 950px) {

  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .posts-toolbar {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;

    padding: 15px;
  }

  .toolbar-right {
    width: 100%;
  }

  .toolbar-right input {
    flex: 1;
  }
}

@media (max-width: 600px) {

  .page-header {
    flex-direction: column;
    gap: 18px;
  }

  .summary-grid {
    grid-template-columns: 1fr;
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