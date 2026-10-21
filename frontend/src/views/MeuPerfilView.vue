<!--
  Meu perfil: dados do usuário logado (nome editável) e troca de senha.
  O e-mail só é alterado pelo administrador.
-->
<template>
  <div class="page">
    <div class="page-header">
      <h1>Meu perfil</h1>
      <p>Seus dados de acesso.</p>
    </div>

    <div class="grade">
      <form class="cartao bloco" novalidate @submit.prevent="salvarNome">
        <h2>Dados</h2>

        <p v-if="msgDados.texto" class="alerta" :class="`alerta--${msgDados.tipo}`">{{ msgDados.texto }}</p>

        <div class="grupo-campo">
          <label for="nome">Nome</label>
          <input id="nome" v-model.trim="nome" class="campo" maxlength="120" :disabled="salvandoNome" />
        </div>

        <div class="grupo-campo">
          <label for="email">E-mail de acesso</label>
          <input id="email" class="campo somente-leitura" :value="usuario?.email" disabled />
          <small v-if="ehCliente">Para trocar o e-mail, fale com o administrador.</small>
        </div>

        <div v-if="usuario?.cliente" class="grupo-campo">
          <label for="cliente">Cliente</label>
          <input id="cliente" class="campo somente-leitura" :value="usuario.cliente.nome" disabled />
        </div>

        <div>
          <button
            class="botao botao--secundario"
            type="submit"
            :disabled="salvandoNome || !nome || nome === usuario?.nome"
          >
            {{ salvandoNome ? "Salvando..." : "Salvar nome" }}
          </button>
        </div>
      </form>

      <form class="cartao bloco" novalidate @submit.prevent="salvarSenha">
        <h2>Trocar senha</h2>

        <p v-if="msgSenha.texto" class="alerta" :class="`alerta--${msgSenha.tipo}`">{{ msgSenha.texto }}</p>

        <div class="grupo-campo">
          <label for="atual">Senha atual</label>
          <input id="atual" v-model="senhaAtual" class="campo" type="password" autocomplete="current-password" :disabled="salvandoSenha" />
        </div>

        <div class="grupo-campo">
          <label for="nova">Nova senha</label>
          <input id="nova" v-model="senhaNova" class="campo" type="password" autocomplete="new-password" :disabled="salvandoSenha" />
          <small>Mínimo de {{ SENHA_MIN }} caracteres.</small>
        </div>

        <div class="grupo-campo">
          <label for="repetir">Repita a nova senha</label>
          <input id="repetir" v-model="repetir" class="campo" type="password" autocomplete="new-password" :disabled="salvandoSenha" />
        </div>

        <div>
          <button class="botao botao--primario" type="submit" :disabled="salvandoSenha">
            {{ salvandoSenha ? "Trocando..." : "Trocar senha" }}
          </button>
        </div>

        <small class="nota">
          Ao trocar a senha, você continua conectado aqui e é desconectado nos outros aparelhos.
        </small>
      </form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from "vue";

import { useSessao } from "../composables/useSessao";

const SENHA_MIN = 8;

const { usuario, ehCliente, trocarSenha, atualizarPerfil } = useSessao();

const nome = ref(usuario.value?.nome || "");
watch(usuario, (u) => { nome.value = u?.nome || ""; });

const salvandoNome = ref(false);
const msgDados = reactive({ tipo: "", texto: "" });

const senhaAtual = ref("");
const senhaNova = ref("");
const repetir = ref("");
const salvandoSenha = ref(false);
const msgSenha = reactive({ tipo: "", texto: "" });

function avisar(alvo, tipo, texto) {
  alvo.tipo = tipo;
  alvo.texto = texto;
}

async function salvarNome() {
  avisar(msgDados, "", "");
  salvandoNome.value = true;
  try {
    await atualizarPerfil({ nome: nome.value });
    avisar(msgDados, "sucesso", "Nome atualizado.");
  } catch (e) {
    avisar(msgDados, "erro", e.message || "Não foi possível salvar.");
  } finally {
    salvandoNome.value = false;
  }
}

async function salvarSenha() {
  avisar(msgSenha, "", "");

  if (!senhaAtual.value) return avisar(msgSenha, "erro", "Informe a senha atual.");
  if (senhaNova.value.length < SENHA_MIN) {
    return avisar(msgSenha, "erro", `A nova senha deve ter pelo menos ${SENHA_MIN} caracteres.`);
  }
  if (senhaNova.value !== repetir.value) return avisar(msgSenha, "erro", "As senhas novas não conferem.");

  salvandoSenha.value = true;
  try {
    await trocarSenha({ senhaAtual: senhaAtual.value, senhaNova: senhaNova.value });
    senhaAtual.value = "";
    senhaNova.value = "";
    repetir.value = "";
    avisar(msgSenha, "sucesso", "Senha trocada com sucesso.");
  } catch (e) {
    avisar(msgSenha, "erro", e.message || "Não foi possível trocar a senha.");
  } finally {
    salvandoSenha.value = false;
  }
}
</script>

<style scoped>
.grade {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  max-width: 980px;
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

.somente-leitura {
  background: #f6f6f6;
  color: #777;
}

.nota {
  color: var(--cor-texto-suave);
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 900px) {
  .grade {
    grid-template-columns: 1fr;
  }
}
</style>
