<template>
  <main class="convite-page">
    <section class="convite-card">
      <div class="marca">◎ IG Manager</div>
      <template v-if="carregando">
        <h1>Validando convite...</h1>
        <p>Aguarde enquanto verificamos o link.</p>
      </template>
      <template v-else-if="erro">
        <h1>Não foi possível acessar o cadastro</h1>
        <p class="erro">{{ erro }}</p>
      </template>
      <template v-else-if="sucesso">
        <h1>Perfil informado!</h1>
        <p>O perfil <strong>@{{ username.replace(/^@+/, "").toLowerCase() }}</strong> foi vinculado a {{ convite.cliente }}.</p>
        <div class="aviso">
          <strong>Próximo passo:</strong> a equipe vai conectar o perfil ao Instagram com você.
          Até lá ele aparece como "Aguardando conexão". Você não precisa fazer mais nada nesta página.
        </div>
      </template>
      <template v-else>
        <h1>Informe o seu perfil do Instagram</h1>
        <p>Link destinado a <strong>{{ convite.cliente }}</strong>. Preencha os dados do perfil em que vamos publicar.</p>
        <form @submit.prevent="enviar">
          <label for="nome">Nome do perfil</label>
          <input id="nome" v-model.trim="nome" maxlength="120" required placeholder="Ex.: Loja Exemplo" />
          <label for="username">Usuário do Instagram</label>
          <div class="username"><span>@</span><input id="username" v-model.trim="username" maxlength="30" required placeholder="usuario" /></div>
          <p class="aviso">Não informe sua senha. A conexão com o Instagram é feita depois pela equipe.</p>
          <p v-if="erroEnvio" class="erro">{{ erroEnvio }}</p>
          <button type="submit" :disabled="enviando">{{ enviando ? "Enviando..." : "Enviar cadastro" }}</button>
        </form>
        <small>Este link expira em {{ new Date(convite.expires_at).toLocaleString("pt-BR") }} e pode ser utilizado uma única vez.</small>
      </template>
    </section>
  </main>
</template>

<script setup>
/*
 * Link enviado ao cliente para ele informar o @ (sem login e sem senha).
 * A conexão com o Instagram é feita depois pelo administrador, em Clientes.
 */
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { consultarConviteConta, cadastrarContaPorConvite } from "../api/contas";

const route = useRoute();
const convite = ref(null);
const carregando = ref(true);
const enviando = ref(false);
const sucesso = ref(false);
const erro = ref("");
const erroEnvio = ref("");
const nome = ref("");
const username = ref("");

onMounted(async () => {
  try { convite.value = await consultarConviteConta(String(route.params.token || "")); }
  catch (e) { erro.value = e.message || "Link inválido, expirado ou já utilizado."; }
  finally { carregando.value = false; }
});

async function enviar() {
  erroEnvio.value = "";
  enviando.value = true;
  try {
    await cadastrarContaPorConvite(String(route.params.token || ""), { nome: nome.value, username: username.value });
    sucesso.value = true;
  } catch (e) { erroEnvio.value = e.message || "Não foi possível enviar o cadastro."; }
  finally { enviando.value = false; }
}
</script>

<style scoped>
.convite-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f7f7f8;font-family:inherit;color:#202124}.convite-card{width:min(100%,480px);padding:32px;border:1px solid #e2e2e5;border-radius:16px;background:#fff;box-shadow:0 12px 36px #0000000d}.marca{margin-bottom:28px;font-size:17px;font-weight:700}.marca:first-letter{color:#bd258c}.convite-card h1{margin:0 0 10px;font-size:23px}.convite-card p{color:#62646b;font-size:14px;line-height:1.6}.convite-card form{display:flex;flex-direction:column;gap:9px;margin:24px 0}.convite-card label{margin-top:8px;font-size:13px;font-weight:600}.convite-card input{width:100%;padding:12px;border:1px solid #d5d6da;border-radius:8px;font:inherit}.username{display:flex;align-items:center;border:1px solid #d5d6da;border-radius:8px;padding-left:12px}.username input{border:0}.aviso{padding:11px;border-radius:8px;background:#fff8e8;font-size:12px!important}.convite-card button{margin-top:8px;padding:13px;border:0;border-radius:8px;background:#242426;color:#fff;font-weight:600;cursor:pointer}.convite-card button:disabled{opacity:.6;cursor:wait}.status{margin:16px 0;padding:10px;border-radius:8px;background:#f2f4f7;color:#344054!important}.convite-card small{color:#777;font-size:11px;line-height:1.5}.erro{color:#b42318!important}
</style>
