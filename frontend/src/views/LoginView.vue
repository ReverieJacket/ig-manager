<!--
  Tela de login, comum a administradores e clientes.
  Depois de entrar, cada perfil vai para a própria tela inicial (ou volta
  para a página que tentou abrir, se ela for permitida para o perfil).
-->
<template>
  <div class="login">
    <aside class="login-lado">
      <div class="logo">
        <div class="logo-icon">◎</div>
        <span>IG Manager</span>
      </div>

      <div>
        <h2>Suas publicações,<br />aprovadas e no ar.</h2>
        <p>
          Administradores criam e agendam. Clientes acompanham e aprovam —
          tudo no mesmo lugar.
        </p>
      </div>

      <span />
    </aside>

    <main class="login-conteudo">
      <form class="login-form" novalidate @submit.prevent="enviar">
        <h1>Entrar</h1>
        <p class="subtitulo">Use o e-mail e a senha cadastrados.</p>

        <div v-if="erro" class="alerta" role="alert">{{ erro }}</div>

        <label class="rotulo" for="email">E-mail</label>
        <input
          id="email"
          v-model.trim="email"
          class="campo"
          type="email"
          autocomplete="username"
          placeholder="voce@empresa.com.br"
          :disabled="enviando"
          required
        />

        <label class="rotulo" for="senha">Senha</label>
        <div class="senha">
          <input
            id="senha"
            v-model="senha"
            class="campo"
            :type="mostrarSenha ? 'text' : 'password'"
            autocomplete="current-password"
            :disabled="enviando"
            required
          />
          <button
            type="button"
            class="mostrar"
            :aria-label="mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'"
            @click="mostrarSenha = !mostrarSenha"
          >
            {{ mostrarSenha ? "Ocultar" : "Mostrar" }}
          </button>
        </div>

        <label class="manter">
          <input v-model="manterConectado" type="checkbox" :disabled="enviando" />
          <span>Manter conectado por 30 dias</span>
        </label>

        <button class="botao botao--primario entrar" type="submit" :disabled="enviando">
          {{ enviando ? "Entrando..." : "Entrar" }}
        </button>

        <p class="nota">
          Esqueceu a senha? Fale com o administrador do sistema.
        </p>
      </form>
    </main>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { rotaInicial, useSessao } from "../composables/useSessao";

const route = useRoute();
const router = useRouter();
const sessao = useSessao();

const email = ref("");
const senha = ref("");
const manterConectado = ref(false);
const mostrarSenha = ref(false);
const enviando = ref(false);
const erro = ref("");

/** Aceita só caminhos internos (evita redirecionar para outro site). */
function destinoSeguro(valor) {
  return typeof valor === "string" && valor.startsWith("/") && !valor.startsWith("//")
    ? valor
    : null;
}

async function enviar() {
  erro.value = "";

  if (!email.value || !senha.value) {
    erro.value = "Informe o e-mail e a senha.";
    return;
  }

  enviando.value = true;

  try {
    const usuario = await sessao.entrar({
      email: email.value,
      senha: senha.value,
      manterConectado: manterConectado.value,
    });

    // Se o destino não for do perfil, a guarda do roteador corrige.
    await router.replace(destinoSeguro(route.query.voltar) || rotaInicial(usuario.perfil));
  } catch (e) {
    erro.value = e.message || "Não foi possível entrar.";
    senha.value = "";
  } finally {
    enviando.value = false;
  }
}
</script>

<style scoped>
.login {
  display: flex;
  min-height: 100vh;
  background: var(--cor-fundo);
}

.login-lado {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 42%;
  max-width: 560px;
  padding: 56px;
  background: linear-gradient(150deg, #f58529 0%, #dd2a7b 50%, #8134af 100%);
  color: #fff;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 22px;
  font-weight: 700;
}

.logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 22px;
}

.login-lado h2 {
  margin: 0 0 16px;
  font-size: 36px;
  font-weight: 800;
  line-height: 1.15;
}

.login-lado p {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  opacity: 0.9;
}

.login-conteudo {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.login-form {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 400px;
}

.login-form h1 {
  margin: 0 0 8px;
  color: var(--cor-titulo);
  font-size: 26px;
}

.subtitulo {
  margin: 0 0 26px;
  color: var(--cor-texto-suave);
  font-size: 14px;
}

.alerta {
  margin-bottom: 18px;
  padding: 11px 13px;
  border-radius: var(--raio);
  background: var(--cor-erro-fundo);
  color: var(--cor-erro-texto);
  font-size: 13px;
}

.rotulo {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
}

.login-form > .campo,
.senha {
  margin-bottom: 18px;
}

.senha {
  position: relative;
}

.senha .campo {
  padding-right: 80px;
}

.mostrar {
  position: absolute;
  top: 50%;
  right: 8px;
  padding: 5px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #555;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transform: translateY(-50%);
}

.mostrar:hover {
  background: #f2f2f2;
}

.manter {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: -2px 0 22px;
  color: #555;
  font-size: 13px;
  cursor: pointer;
}

.manter input {
  width: 15px;
  height: 15px;
  accent-color: var(--cor-primaria);
}

.entrar {
  width: 100%;
}

.nota {
  margin: 20px 0 0;
  color: var(--cor-texto-suave);
  font-size: 12px;
  text-align: center;
}

@media (max-width: 800px) {
  .login-lado {
    display: none;
  }
}
</style>
