<!--
  Meus perfis (cliente): perfis do Instagram em que publicamos para o
  cliente. O próprio cliente informa o @ (sem senha); a conexão com o
  Instagram é concluída pela equipe.
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
                <span>
                  {{ conta.nome }}
                  <template v-if="conta.cadastradaEm"> · informada em {{ formatarDia(conta.cadastradaEm) }}</template>
                </span>
              </div>
              <span class="selo" :class="seloDe(conta).classe">● {{ seloDe(conta).rotulo }}</span>
            </li>
          </ul>

          <p v-if="contas.some((c) => c.status === 'expirada')" class="alerta alerta--erro">
            A conexão de um perfil com o Instagram <strong>expirou</strong> e as publicações nele estão
            paradas. A equipe já foi avisada e vai reconectar com você.
          </p>
          <p v-if="contas.some((c) => seloDe(c).classe === 'selo--aviso')" class="alerta alerta--aviso">
            Perfis <strong>aguardando conexão</strong> ainda não recebem publicações. A equipe vai
            entrar em contato para concluir a conexão com o Instagram.
          </p>
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
          <li>A equipe conecta o perfil ao sistema com você.</li>
          <li>Pronto: o perfil passa a receber as publicações.</li>
        </ol>
      </form>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";

import { adicionarMinhaConta, listarMinhasContas } from "../api/minhaArea";

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

onMounted(carregar);
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
