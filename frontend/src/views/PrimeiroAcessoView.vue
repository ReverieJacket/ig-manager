<!--
  Primeiro acesso: quem entrou com a senha temporária gerada pelo
  administrador é obrigado a criar a própria senha antes de usar o sistema.
  A senha temporária não é pedida de novo (a pessoa acabou de usá-la).
-->
<template>
  <div class="tela">
    <form class="cartao-acesso" novalidate @submit.prevent="salvar">
      <div class="logo">
        <div class="logo-icon">◎</div>
        <span>IG Manager</span>
      </div>

      <h1>Crie a sua senha</h1>
      <p class="texto">
        Olá, {{ primeiroNome }}! Você entrou com uma senha temporária. Para
        continuar, escolha uma senha só sua — nem o administrador terá acesso a ela.
      </p>

      <p v-if="erro" class="alerta alerta--erro" role="alert">{{ erro }}</p>

      <div class="grupo-campo">
        <label for="nova">Nova senha</label>
        <input
          id="nova"
          v-model="senhaNova"
          class="campo"
          type="password"
          autocomplete="new-password"
          :disabled="salvando"
        />
      </div>

      <ul class="regras">
        <li :class="{ ok: tamanhoOk }">{{ tamanhoOk ? "✓" : "•" }} Pelo menos {{ SENHA_MIN }} caracteres</li>
        <li :class="{ ok: confere }">{{ confere ? "✓" : "•" }} As duas senhas iguais</li>
      </ul>

      <div class="grupo-campo">
        <label for="repetir">Repita a nova senha</label>
        <input
          id="repetir"
          v-model="repetir"
          class="campo"
          type="password"
          autocomplete="new-password"
          :disabled="salvando"
        />
      </div>

      <button class="botao botao--primario" type="submit" :disabled="salvando || !podeSalvar">
        {{ salvando ? "Salvando..." : "Salvar e entrar" }}
      </button>

      <p class="rodape">
        Não é você?
        <button type="button" class="link" :disabled="salvando" @click="sairDoSistema">Sair</button>
      </p>
    </form>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { rotaInicial, useSessao } from "../composables/useSessao";

/** Mesmo mínimo do backend (`lib/senhas.js`). */
const SENHA_MIN = 8;

const router = useRouter();
const sessao = useSessao();

const senhaNova = ref("");
const repetir = ref("");
const salvando = ref(false);
const erro = ref("");

const primeiroNome = computed(() => sessao.usuario.value?.nome?.split(" ")[0] || "");
const tamanhoOk = computed(() => senhaNova.value.length >= SENHA_MIN);
const confere = computed(() => senhaNova.value !== "" && senhaNova.value === repetir.value);
const podeSalvar = computed(() => tamanhoOk.value && confere.value);

async function salvar() {
  erro.value = "";
  if (!podeSalvar.value) {
    erro.value = "Confira as regras da senha.";
    return;
  }

  salvando.value = true;
  try {
    const usuario = await sessao.trocarSenha({ senhaNova: senhaNova.value });
    await router.replace(rotaInicial(usuario.perfil));
  } catch (e) {
    erro.value = e.message || "Não foi possível salvar a senha.";
  } finally {
    salvando.value = false;
  }
}

async function sairDoSistema() {
  try {
    await sessao.sair();
  } finally {
    router.replace({ name: "login" });
  }
}
</script>

<style scoped>
.tela {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: var(--cor-fundo);
}

.cartao-acesso {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 440px;
  padding: 32px;
  border: 1px solid var(--cor-borda);
  border-radius: 14px;
  background: #fff;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
}

.logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(135deg, #f58529, #dd2a7b, #8134af);
  color: #fff;
  font-size: 20px;
}

h1 {
  margin: 4px 0 0;
  color: var(--cor-titulo);
  font-size: 22px;
}

.texto {
  margin: -6px 0 0;
  color: var(--cor-texto-suave);
  font-size: 13.5px;
  line-height: 1.55;
}

.regras {
  display: grid;
  gap: 4px;
  margin: -8px 0 0;
  padding: 0;
  color: #777;
  font-size: 12.5px;
  list-style: none;
}

.regras .ok {
  color: var(--cor-sucesso-texto);
}

.rodape {
  margin: 0;
  color: var(--cor-texto-suave);
  font-size: 12px;
  text-align: center;
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--cor-primaria);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
</style>
