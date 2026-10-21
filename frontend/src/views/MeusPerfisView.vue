<!--
  Meus perfis (cliente): perfis do Instagram em que publicamos para o
  cliente. O próprio cliente informa o @ (sem senha) e, quando liberado
  (`podeConectar`), conecta o perfil: o Chromium abre e ele faz o login
  no Instagram ali mesmo. A senha nunca passa pelo sistema.
-->
<template>
  <div class="page">
    <div class="page-header">
      <h1>Meus perfis</h1>
      <p>Os perfis do Instagram em que publicamos para você.</p>
    </div>

    <div class="grade">
      <section class="cartao bloco">
        <div v-if="carregando" class="estado-vazio">Carregando perfis...</div>

        <div v-else-if="erro" class="estado-vazio">
          <strong>Não foi possível carregar os perfis</strong>
          <span>{{ erro }}</span>
          <button class="botao botao--secundario botao--pequeno" type="button" @click="carregar">
            Tentar novamente
          </button>
        </div>

        <div v-else-if="contas.length === 0" class="estado-vazio">
          <strong>Nenhum perfil ainda</strong>
          <span>Informe ao lado o @ do seu perfil do Instagram.</span>
        </div>

        <template v-else>
          <ul class="lista">
            <li v-for="conta in contas" :key="conta.id" class="item">
              <div class="avatar" aria-hidden="true">{{ iniciais(conta.nome || conta.username) }}</div>
              <div class="dados">
                <strong>@{{ conta.username }}</strong>
                <span v-if="conexao[conta.id]" :class="conexao[conta.id].classe">{{ conexao[conta.id].texto }}</span>
                <span v-else>
                  {{ conta.nome }}
                  <template v-if="conta.cadastradaEm"> · informada em {{ formatarDia(conta.cadastradaEm) }}</template>
                </span>
              </div>
              <span class="selo" :class="seloDe(conta).classe">● {{ seloDe(conta).rotulo }}</span>
              <button
                v-if="conta.podeConectar && seloDe(conta).classe !== 'selo--sucesso'"
                class="botao botao--primario botao--pequeno"
                type="button"
                :disabled="emAndamento(conta.id)"
                @click="conectar(conta)"
              >
                {{ emAndamento(conta.id) ? "Aguardando login..." : conta.status === "expirada" ? "Reconectar" : "Conectar" }}
              </button>
            </li>
          </ul>

          <p v-if="algumEmAndamento" class="alerta alerta--info">
            Uma janela do navegador foi aberta com o Instagram. <strong>Entre na sua conta por ela</strong>
            (e confirme o código, se o Instagram pedir). Assim que o login terminar, a janela fecha
            sozinha e o perfil fica <strong>Conectado</strong>. Sua senha não é guardada pelo sistema.
          </p>
          <template v-else-if="podeConectar">
            <p v-if="contas.some((c) => c.status === 'expirada')" class="alerta alerta--erro">
              A conexão de um perfil com o Instagram <strong>expirou</strong> e as publicações nele estão
              paradas. Clique em <strong>Reconectar</strong> e entre na sua conta de novo.
            </p>
            <p v-if="contas.some((c) => seloDe(c).classe === 'selo--aviso')" class="alerta alerta--aviso">
              Perfis <strong>aguardando conexão</strong> ainda não recebem publicações. Clique em
              <strong>Conectar</strong> e entre na sua conta do Instagram na janela que abrir.
            </p>
          </template>
          <template v-else>
            <p v-if="contas.some((c) => c.status === 'expirada')" class="alerta alerta--erro">
              A conexão de um perfil com o Instagram <strong>expirou</strong> e as publicações nele estão
              paradas. A equipe já foi avisada e vai reconectar com você.
            </p>
            <p v-if="contas.some((c) => seloDe(c).classe === 'selo--aviso')" class="alerta alerta--aviso">
              Perfis <strong>aguardando conexão</strong> ainda não recebem publicações. A equipe vai
              entrar em contato para concluir a conexão com o Instagram.
            </p>
          </template>
        </template>
      </section>

      <form class="cartao bloco" novalidate @submit.prevent="adicionar">
        <h2>Adicionar perfil</h2>

        <p v-if="mensagem.texto" class="alerta" :class="`alerta--${mensagem.tipo}`">{{ mensagem.texto }}</p>

        <div class="grupo-campo">
          <label for="nome-conta">Nome do perfil</label>
          <input
            id="nome-conta"
            v-model.trim="form.nome"
            class="campo"
            maxlength="120"
            placeholder="Ex.: Padaria Bella Massa"
            :disabled="enviando"
          />
        </div>

        <div class="grupo-campo">
          <label for="usuario-ig">Usuário do Instagram</label>
          <div class="arroba">
            <span aria-hidden="true">@</span>
            <input
              id="usuario-ig"
              v-model.trim="form.username"
              class="campo"
              maxlength="31"
              placeholder="seuperfil"
              autocomplete="off"
              :disabled="enviando"
            />
          </div>
        </div>

        <button class="botao botao--primario" type="submit" :disabled="enviando">
          {{ enviando ? "Adicionando..." : "Adicionar perfil" }}
        </button>

        <ol class="passos">
          <li>Você informa o @ aqui — <strong>sem senha</strong>.</li>
          <li v-if="podeConectar">Você clica em <strong>Conectar</strong> e entra no Instagram pela janela que abrir.</li>
          <li v-else>A equipe conecta o perfil ao sistema com você.</li>
          <li>Pronto: o perfil passa a receber as publicações.</li>
        </ol>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";

import {
  adicionarMinhaConta,
  conectarMeuPerfil,
  consultarConexaoMeuPerfil,
  listarMinhasContas,
} from "../api/minhaArea";

const contas = ref([]);
const carregando = ref(true);
const erro = ref("");

const form = reactive({ nome: "", username: "" });
const enviando = ref(false);
const mensagem = reactive({ tipo: "", texto: "" });

function iniciais(texto) {
  return String(texto || "")
    .replace(/^@/, "")
    .split(/[\s._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
}

/** Selo de situação; aceita respostas antigas sem `status`. */
function seloDe(conta) {
  const status = conta.status || (conta.conectada ? "conectado" : "aguardando");
  if (status === "expirada") return { rotulo: "Sessão expirada", classe: "selo--erro" };
  if (status === "conectado") return { rotulo: "Conectado", classe: "selo--sucesso" };
  return { rotulo: "Aguardando conexão", classe: "selo--aviso" };
}

function formatarDia(data) {
  return new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

async function carregar() {
  carregando.value = true;
  erro.value = "";
  try {
    contas.value = await listarMinhasContas();
  } catch (e) {
    erro.value = e.message;
  } finally {
    carregando.value = false;
  }
}

async function adicionar() {
  mensagem.tipo = "";
  mensagem.texto = "";

  if (!form.nome || !form.username) {
    mensagem.tipo = "erro";
    mensagem.texto = "Preencha o nome e o usuário do Instagram.";
    return;
  }

  enviando.value = true;
  try {
    await adicionarMinhaConta({ nome: form.nome, username: form.username });
    mensagem.tipo = "sucesso";
    mensagem.texto = `@${form.username.replace(/^@+/, "").toLowerCase()} adicionado. A equipe vai concluir a conexão.`;
    form.nome = "";
    form.username = "";
    await carregar();
  } catch (e) {
    mensagem.tipo = "erro";
    mensagem.texto = e.message || "Não foi possível adicionar o perfil.";
  } finally {
    enviando.value = false;
  }
}

/* ------------------------- conexão com o Instagram ------------------------- */

const podeConectar = computed(() => contas.value.some((c) => c.podeConectar));

/** Estado da conexão por perfil: { status, texto, classe }. */
const conexao = ref({});
const intervalos = new Map();
const EM_ANDAMENTO = ["iniciando", "aguardando_login"];

const TEXTOS = {
  iniciando: { texto: "Abrindo o navegador...", classe: "txt-info" },
  aguardando_login: { texto: "Entre na sua conta na janela do Instagram que abriu.", classe: "txt-info" },
  conectado: { texto: "Conectado! Já pode receber publicações.", classe: "txt-sucesso" },
  cancelado: { texto: "A janela foi fechada antes do login. Tente de novo.", classe: "txt-erro" },
  erro: { texto: "Não foi possível conectar. Tente de novo.", classe: "txt-erro" },
};

const algumEmAndamento = computed(() => Object.keys(conexao.value).some((id) => emAndamento(id)));

function emAndamento(id) {
  return EM_ANDAMENTO.includes(conexao.value[id]?.status);
}

function definirConexao(id, status, mensagemErro) {
  const base = TEXTOS[status] || TEXTOS.erro;
  conexao.value[id] = { status, ...base, ...(mensagemErro ? { texto: mensagemErro } : {}) };
}

function pararAcompanhamento(id) {
  clearInterval(intervalos.get(id));
  intervalos.delete(id);
}

async function conectar(conta) {
  try {
    const r = await conectarMeuPerfil(conta.id);
    definirConexao(conta.id, r.status || "iniciando");
  } catch (e) {
    definirConexao(conta.id, "erro", e.message);
    return;
  }

  pararAcompanhamento(conta.id);
  intervalos.set(
    conta.id,
    setInterval(async () => {
      try {
        const r = await consultarConexaoMeuPerfil(conta.id);
        definirConexao(conta.id, r.status);
        if (!EM_ANDAMENTO.includes(r.status)) {
          pararAcompanhamento(conta.id);
          await carregar();
          // A mensagem de sucesso some sozinha; a de erro fica até nova tentativa.
          if (r.status === "conectado") setTimeout(() => { delete conexao.value[conta.id]; }, 6000);
        }
      } catch (e) {
        definirConexao(conta.id, "erro", e.message);
        pararAcompanhamento(conta.id);
      }
    }, 3000)
  );
}

onMounted(carregar);
onBeforeUnmount(() => {
  for (const id of [...intervalos.keys()]) pararAcompanhamento(id);
});
</script>

<style scoped>
.grade {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 18px;
  align-items: start;
}

.bloco {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 22px;
}

.bloco h2 {
  margin: 0;
  color: var(--cor-titulo);
  font-size: 16px;
}

.lista {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e6e6e6;
  border-radius: 10px;
}

.avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f58529, #dd2a7b, #8134af);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
}

.dados {
  flex: 1;
  min-width: 0;
}

.dados strong {
  display: block;
  font-size: 14px;
}

.dados span {
  color: #888;
  font-size: 12px;
}

.alerta--info {
  background: #eef3ff;
  color: #2b4fae;
}

.txt-info {
  color: #2b4fae !important;
}

.txt-sucesso {
  color: var(--cor-sucesso-texto) !important;
}

.txt-erro {
  color: var(--cor-erro-texto) !important;
}

.arroba {
  position: relative;
}

.arroba > span {
  position: absolute;
  top: 50%;
  left: 12px;
  color: #888;
  font-size: 13px;
  transform: translateY(-50%);
}

.arroba .campo {
  padding-left: 26px;
}

.passos {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 18px;
  color: #555;
  font-size: 12.5px;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .grade {
    grid-template-columns: 1fr;
  }
}
</style>
