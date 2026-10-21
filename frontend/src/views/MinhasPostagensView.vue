<!--
  Minhas postagens (cliente): publicações programadas e publicadas das
  contas do cliente, só para leitura. A aprovação chega na etapa 3.
-->
<template>
  <div class="page">
    <div class="page-header">
      <h1>Minhas postagens</h1>
      <p>Veja o que já foi publicado e o que está programado nas suas contas.</p>
    </div>

    <div class="resumo">
      <div class="resumo-card">
        <span>Publicadas este mês</span>
        <strong>{{ resumo.publicadasMes }}</strong>
      </div>
      <div class="resumo-card">
        <span>Programadas</span>
        <strong>{{ resumo.programadas }}</strong>
      </div>
      <div class="resumo-card">
        <span>Curtidas no mês</span>
        <strong>{{ resumo.curtidasMes.toLocaleString("pt-BR") }}</strong>
      </div>
    </div>

    <section class="cartao">
      <div class="barra">
        <div class="abas" role="tablist">
          <button
            v-for="aba in ABAS"
            :key="aba.valor"
            type="button"
            role="tab"
            :aria-selected="filtro === aba.valor"
            :class="{ selecionada: filtro === aba.valor }"
            @click="filtro = aba.valor"
          >
            {{ aba.rotulo }}
          </button>
        </div>

        <select v-if="contas.length > 1" v-model="contaFiltro" class="campo filtro-conta" aria-label="Filtrar por conta">
          <option value="">Todos os perfis</option>
          <option v-for="conta in contas" :key="conta" :value="conta">@{{ conta }}</option>
        </select>
      </div>

      <div v-if="carregando" class="estado-vazio">Carregando postagens...</div>

      <div v-else-if="erro" class="estado-vazio">
        <strong>Não foi possível carregar as postagens</strong>
        <span>{{ erro }}</span>
        <button class="botao botao--secundario botao--pequeno" type="button" @click="carregar">
          Tentar novamente
        </button>
      </div>

      <div v-else-if="filtradas.length === 0" class="estado-vazio">
        <strong>Nenhuma postagem por aqui</strong>
        <span>Quando a equipe programar ou publicar algo nos seus perfis, aparece aqui.</span>
      </div>

      <div v-else class="grade">
        <article v-for="post in filtradas" :key="post.id" class="post">
          <div class="imagem">
            <img v-if="post.imagem" :src="post.imagem" alt="" loading="lazy" />
            <span v-else>Sem imagem</span>
          </div>

          <div class="corpo">
            <div class="linha">
              <span class="conta">@{{ post.username }}</span>
              <span class="selo" :class="seloDe(post.status).classe">{{ seloDe(post.status).rotulo }}</span>
            </div>

            <p class="legenda">{{ post.texto || "Sem legenda" }}</p>

            <div class="rodape">
              <span>{{ formatarData(post.data_hora) }}</span>
              <span v-if="post.status === STATUS.PUBLICADA">
                ♡ {{ formatarCurtidas(post.curtidas, post.curtidas_aproximado) }}
                · ◌ {{ post.comentarios_total ?? 0 }}
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";

import { listarMinhasPublicacoes } from "../api/minhaArea";
import { STATUS } from "../constants/publicacoes";
import { formatarCurtidas, formatarData } from "../utils/formatadores";

const ABAS = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "programadas", rotulo: "Programadas" },
  { valor: "publicadas", rotulo: "Publicadas" },
];

const publicacoes = ref([]);
const carregando = ref(true);
const erro = ref("");
const filtro = ref("todas");
const contaFiltro = ref("");

const ehProgramada = (post) => post.status === STATUS.AGENDADA || post.status === STATUS.PUBLICANDO;

function seloDe(status) {
  if (status === STATUS.PUBLICADA) return { rotulo: "Publicada", classe: "selo--sucesso" };
  if (status === STATUS.PUBLICANDO) return { rotulo: "Publicando", classe: "selo--info" };
  return { rotulo: "Programada", classe: "selo--info" };
}

const contas = computed(() => [...new Set(publicacoes.value.map((p) => p.username).filter(Boolean))]);

const filtradas = computed(() =>
  publicacoes.value.filter((post) => {
    if (contaFiltro.value && post.username !== contaFiltro.value) return false;
    if (filtro.value === "programadas") return ehProgramada(post);
    if (filtro.value === "publicadas") return post.status === STATUS.PUBLICADA;
    return true;
  })
);

const resumo = computed(() => {
  const agora = new Date();
  const doMes = (post) => {
    const data = new Date(post.data_hora);
    return data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear();
  };
  const publicadasMes = publicacoes.value.filter((p) => p.status === STATUS.PUBLICADA && doMes(p));

  return {
    publicadasMes: publicadasMes.length,
    programadas: publicacoes.value.filter(ehProgramada).length,
    curtidasMes: publicadasMes.reduce((total, p) => total + (Number(p.curtidas) || 0), 0),
  };
});

async function carregar() {
  carregando.value = true;
  erro.value = "";
  try {
    publicacoes.value = await listarMinhasPublicacoes();
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
}

onMounted(carregar);
</script>

<style scoped>
.resumo {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 18px;
}

.resumo-card {
  padding: 17px 18px;
  border: 1px solid var(--cor-borda);
  border-radius: 9px;
  background: #fff;
}

.resumo-card span {
  display: block;
  margin-bottom: 7px;
  color: var(--cor-texto-suave);
  font-size: 12px;
}

.resumo-card strong {
  font-size: 24px;
}

.barra {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #eee;
}

.abas {
  display: flex;
  gap: 4px;
}

.abas button {
  padding: 8px 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #555;
  font-size: 13px;
  cursor: pointer;
}

.abas button.selecionada {
  background: #eee;
  color: #111;
  font-weight: 600;
}

.filtro-conta {
  width: auto;
  min-width: 190px;
  padding: 9px 12px;
}

.grade {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  padding: 16px;
}

.post {
  overflow: hidden;
  border: 1px solid #e6e6e6;
  border-radius: 10px;
  background: #fff;
}

.imagem {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  background: #f2f2f2;
  color: #999;
  font-size: 12px;
}

.imagem img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.corpo {
  padding: 12px 14px;
}

.linha {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.conta {
  overflow: hidden;
  color: #666;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.legenda {
  display: -webkit-box;
  height: 36px;
  margin: 0 0 10px;
  overflow: hidden;
  color: #333;
  font-size: 12.5px;
  line-height: 1.45;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.rodape {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding-top: 9px;
  border-top: 1px solid #f0f0f0;
  color: #777;
  font-size: 12px;
}

@media (max-width: 700px) {
  .resumo {
    grid-template-columns: 1fr;
  }

  .barra {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
