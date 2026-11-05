<!--
  Minhas postagens (cliente): publicações programadas e publicadas dos
  perfis do cliente, mais as que ficaram SEM RESPOSTA (prazo esgotado nos
  últimos 30 dias), que podem ser publicadas agora ou agendadas de novo.
  Deferir/indeferir fica em Aprovações.
-->
<template>
  <div class="page">
    <div class="page-header">
      <h1>Minhas postagens</h1>
      <p>Veja o que já foi publicado, o que está programado e o que ficou sem resposta nos seus perfis.</p>
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
      <button
        type="button"
        class="resumo-card clicavel"
        :class="{ destaque: resumo.semResposta > 0 }"
        title="Ver os posts sem resposta"
        @click="filtro = 'sem-resposta'"
      >
        <span>Sem resposta</span>
        <strong>{{ resumo.semResposta }}</strong>
      </button>
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
            <span v-if="aba.valor === 'sem-resposta' && resumo.semResposta > 0" class="contagem-aba">{{ resumo.semResposta }}</span>
          </button>
        </div>

        <select v-if="contas.length > 1" v-model="contaFiltro" class="campo filtro-conta" aria-label="Filtrar por conta">
          <option value="">Todos os perfis</option>
          <option v-for="conta in contas" :key="conta" :value="conta">@{{ conta }}</option>
        </select>
      </div>

      <p v-if="aviso.texto" class="alerta faixa-aviso" :class="`alerta--${aviso.tipo}`" role="status">{{ aviso.texto }}</p>

      <div v-if="carregando" class="estado-vazio">Carregando postagens...</div>

      <div v-else-if="erro" class="estado-vazio">
        <strong>Não foi possível carregar as postagens</strong>
        <span>{{ erro }}</span>
        <button class="botao botao--secundario botao--pequeno" type="button" @click="carregar">
          Tentar novamente
        </button>
      </div>

      <div v-else-if="filtradas.length === 0" class="estado-vazio">
        <template v-if="filtro === 'sem-resposta'">
          <strong>Nenhum post sem resposta</strong>
          <span>Quando o prazo de aprovação de um post acabar sem resposta, ele fica aqui por 30 dias para você publicar ou agendar.</span>
        </template>
        <template v-else>
          <strong>Nenhuma postagem por aqui</strong>
          <span>Quando a equipe programar ou publicar algo nos seus perfis, aparece aqui.</span>
        </template>
      </div>

      <div v-else class="grade">
        <article v-for="post in filtradas" :key="post.id" class="post" :class="{ 'post--sem-resposta': post.semResposta }">
          <div class="imagem">
            <img v-if="post.imagem" :src="post.imagem" alt="" loading="lazy" />
            <span v-else>Sem imagem</span>
          </div>

          <div class="corpo">
            <div class="linha">
              <span class="conta">@{{ post.username }}</span>
              <span class="selo" :class="seloDe(post).classe">{{ seloDe(post).rotulo }}</span>
            </div>

            <p class="legenda">{{ post.texto || "Sem legenda" }}</p>

            <template v-if="post.semResposta">
              <p class="nota-sem-resposta">
                ⏱ O prazo acabou sem resposta e o post não saiu. Dá para usar até {{ formatarDia(limiteRetomada(post)) }}.
              </p>
              <div class="acoes-post">
                <button class="botao botao--pequeno botao--publicar" type="button" @click="retomando = { publicacao: post, acao: 'publicar' }">
                  ▶ Publicar agora
                </button>
                <button class="botao botao--secundario botao--pequeno" type="button" @click="retomando = { publicacao: post, acao: 'agendar' }">
                  🗓 Agendar
                </button>
              </div>
            </template>

            <router-link v-else-if="aguardaAprovacao(post)" to="/aprovacoes" class="nota-aprovacao">
              Aguarda a sua aprovação até {{ formatarData(post.data_hora) }} → responder
            </router-link>

            <div class="rodape">
              <span>{{ post.semResposta ? `Era para ${formatarData(post.data_hora)}` : formatarData(post.data_hora) }}</span>
              <span v-if="post.status === STATUS.PUBLICADA">
                ♡ {{ formatarCurtidas(post.curtidas, post.curtidas_aproximado) }}
                · ◌ {{ post.comentarios_total ?? 0 }}
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <ModalRetomar
      v-if="retomando"
      :publicacao="retomando.publicacao"
      :acao="retomando.acao"
      :enviar="(dados) => retomarPublicacao(retomando.publicacao.id, dados)"
      @fechar="retomando = null"
      @concluido="aoRetomar"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";

import ModalRetomar from "../components/publicacoes/ModalRetomar.vue";
import { listarAprovacoes, listarMinhasPublicacoes, retomarPublicacao } from "../api/minhaArea";
import { APROVACAO, STATUS } from "../constants/publicacoes";
import { formatarCurtidas, formatarData } from "../utils/formatadores";

const ABAS = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "programadas", rotulo: "Programadas" },
  { valor: "publicadas", rotulo: "Publicadas" },
  { valor: "sem-resposta", rotulo: "Sem resposta" },
];

/** Dias depois do horário em que um post sem resposta ainda pode ser usado. */
const DIAS_PARA_RETOMAR = 30;

const publicacoes = ref([]);
const carregando = ref(true);
const erro = ref("");
const filtro = ref("todas");
const contaFiltro = ref("");

const ehProgramada = (post) => post.status === STATUS.AGENDADA || post.status === STATUS.PUBLICANDO;

const aguardaAprovacao = (post) =>
  post.status === STATUS.AGENDADA && post.aprovacao === APROVACAO.PENDENTE;

function seloDe(post) {
  if (post.semResposta) return { rotulo: "Sem resposta", classe: "selo--aviso" };
  if (post.status === STATUS.PUBLICADA) return { rotulo: "Publicada", classe: "selo--sucesso" };
  if (post.status === STATUS.PUBLICANDO) return { rotulo: "Publicando", classe: "selo--info" };
  if (aguardaAprovacao(post)) return { rotulo: "Aguarda aprovação", classe: "selo--aviso" };
  return { rotulo: "Programada", classe: "selo--info" };
}

function limiteRetomada(post) {
  return new Date(new Date(post.data_hora).getTime() + DIAS_PARA_RETOMAR * 24 * 60 * 60 * 1000);
}

function formatarDia(data) {
  return new Date(data).toLocaleDateString("pt-BR");
}

const contas = computed(() => [...new Set(publicacoes.value.map((p) => p.username).filter(Boolean))]);

const filtradas = computed(() =>
  publicacoes.value.filter((post) => {
    if (contaFiltro.value && post.username !== contaFiltro.value) return false;
    if (filtro.value === "programadas") return ehProgramada(post);
    if (filtro.value === "publicadas") return post.status === STATUS.PUBLICADA;
    if (filtro.value === "sem-resposta") return Boolean(post.semResposta);
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
    semResposta: publicacoes.value.filter((p) => p.semResposta).length,
    curtidasMes: publicadasMes.reduce((total, p) => total + (Number(p.curtidas) || 0), 0),
  };
});

/**
 * Junta as publicações do cliente com as que ficaram sem resposta (vêm da
 * tela de aprovações). Se só a segunda falhar, a tela abre sem elas.
 */
async function carregar({ silencioso = false } = {}) {
  if (!silencioso) carregando.value = true;
  erro.value = "";
  try {
    const [lista, aprovacoes] = await Promise.all([
      listarMinhasPublicacoes(),
      listarAprovacoes().catch(() => ({ semResposta: [] })),
    ]);
    const semResposta = aprovacoes.semResposta.map((p) => ({ ...p, semResposta: true }));
    const ids = new Set(semResposta.map((p) => p.id));
    publicacoes.value = [...lista.filter((p) => !ids.has(p.id)), ...semResposta].sort(
      (a, b) => new Date(b.data_hora) - new Date(a.data_hora)
    );
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
}

/* -------------------- sem resposta: publicar ou agendar -------------------- */

const retomando = ref(null);
const aviso = reactive({ tipo: "", texto: "" });

async function aoRetomar({ acao, dataHora }) {
  const p = retomando.value.publicacao;
  retomando.value = null;
  aviso.tipo = "sucesso";
  aviso.texto =
    acao === "publicar"
      ? `Publicando o post de @${p.username}. Em cerca de 1 minuto ele aparece como publicado.`
      : `Post de @${p.username} agendado para ${formatarData(dataHora)}. Ele já está deferido.`;
  setTimeout(() => { aviso.texto = ""; }, 6000);
  filtro.value = "todas";
  await carregar({ silencioso: true });
  if (acao === "publicar") setTimeout(() => carregar({ silencioso: true }), 70000);
}

onMounted(carregar);
</script>

<style scoped>
.resumo {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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

button.resumo-card {
  font: inherit;
  text-align: left;
  cursor: pointer;
}

button.resumo-card:hover {
  border-color: #bbb;
}

.resumo-card.destaque {
  border-color: #f0c36a;
  background: #fffaf0;
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

.contagem-aba {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 10px;
  background: #f1e2c4;
  color: #7a5200;
  font-size: 11.5px;
  font-weight: 600;
}

.faixa-aviso {
  margin: 14px 16px 0;
}

.post--sem-resposta {
  border-color: #f0c36a;
}

.post--sem-resposta .imagem img {
  opacity: 0.85;
}

.nota-sem-resposta {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 7px;
  background: #fff6e0;
  color: #7a5200;
  font-size: 12px;
  line-height: 1.45;
}

.acoes-post {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.acoes-post .botao {
  flex: 1;
}

.botao--publicar {
  border: 1px solid #1f7a3d;
  background: #1f7a3d;
  color: #fff;
}

.botao--publicar:hover:not(:disabled) {
  background: #18632f;
}

.nota-aprovacao {
  display: block;
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: 7px;
  background: #fff6e0;
  color: #7a5200;
  font-size: 12px;
  text-decoration: none;
}

.nota-aprovacao:hover {
  text-decoration: underline;
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

@media (max-width: 950px) {
  .resumo {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 700px) {
  .resumo {
    gap: 8px;
  }

  .resumo-card {
    padding: 12px 13px;
  }

  .resumo-card strong {
    font-size: 20px;
  }

  .barra {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 700px) {
  .abas {
    overflow-x: auto;
  }

  .abas button {
    flex: none;
    white-space: nowrap;
  }

  .filtro-conta {
    width: 100%;
    min-width: 0;
  }
}
</style>
