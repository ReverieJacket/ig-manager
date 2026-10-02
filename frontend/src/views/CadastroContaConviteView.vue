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
        <h1>Conta cadastrada!</h1>
        <p>A conta <strong>@{{ username }}</strong> foi vinculada a {{ convite.cliente }}.</p>
        <div class="aviso"><strong>Conexão local:</strong> ao iniciar, o Chromium será aberto na máquina que executa o backend. Neste modo de desenvolvimento, o login precisa ser concluído nessa máquina. Não informe sua senha neste formulário.</div>
        <p v-if="statusConexao" class="status">{{ mensagemStatus }}</p>
        <p v-if="erroConexao" class="erro">{{ erroConexao }}</p>
        <button type="button" :disabled="conectando || statusConexao === 'conectado'" @click="iniciarConexao">{{ conectando ? "Abrindo navegador..." : statusConexao === "conectado" ? "Instagram conectado" : "Conectar Instagram" }}</button>
      </template>
      <template v-else>
        <h1>Cadastro de conta Instagram</h1>
        <p>Convite destinado a <strong>{{ convite.cliente }}</strong>. Preencha os dados da conta que deseja vincular.</p>
        <form @submit.prevent="enviar">
          <label for="nome">Nome da conta</label>
          <input id="nome" v-model.trim="nome" maxlength="120" required placeholder="Ex.: Loja Exemplo" />
          <label for="username">Usuário do Instagram</label>
          <div class="username"><span>@</span><input id="username" v-model.trim="username" maxlength="30" required placeholder="usuario" /></div>
          <p class="aviso">Não informe sua senha. A conexão será realizada posteriormente pelo administrador, em um navegador seguro.</p>
          <p v-if="erroEnvio" class="erro">{{ erroEnvio }}</p>
          <button type="submit" :disabled="enviando">{{ enviando ? "Enviando..." : "Enviar cadastro" }}</button>
        </form>
        <small>Este convite expira em {{ new Date(convite.expires_at).toLocaleString("pt-BR") }} e pode ser utilizado uma única vez.</small>
      </template>
    </section>
  </main>
</template>

<script setup>
import { onMounted, onUnmounted, ref, computed } from "vue";
import { useRoute } from "vue-router";
import { consultarConviteConta, cadastrarContaPorConvite, conectarInstagram, consultarConexao } from "../api/contas";

const route = useRoute();
const convite = ref(null);
const carregando = ref(true);
const enviando = ref(false);
const sucesso = ref(false);
const erro = ref("");
const erroEnvio = ref("");
const nome = ref("");
const username = ref("");
const contaId = ref(null);
const conectando = ref(false);
const statusConexao = ref("");
const erroConexao = ref("");
let intervaloStatus = null;
const mensagemStatus = computed(() => ({
  iniciando: "Preparando o navegador do Instagram...",
  aguardando_login: "Navegador aberto. Conclua o login na máquina do backend.",
  conectado: "Conexão realizada com sucesso!",
  erro: "Não foi possível concluir a conexão. Verifique o navegador e tente novamente.",
  cancelado: "A conexão foi encerrada.",
  desconectado: "A conta ainda não está conectada."
}[statusConexao.value] || "Aguardando atualização do status..."));

onMounted(async () => {
  try { convite.value = await consultarConviteConta(String(route.params.token || "")); }
  catch (e) { erro.value = e.message || "Convite inválido, expirado ou já utilizado."; }
  finally { carregando.value = false; }
});

async function enviar() {
  erroEnvio.value = "";
  enviando.value = true;
  try {
    const conta = await cadastrarContaPorConvite(String(route.params.token || ""), { nome: nome.value, username: username.value });
    contaId.value = conta?.id ?? conta?.conta?.id ?? null;
    sucesso.value = true;
  } catch (e) { erroEnvio.value = e.message || "Não foi possível enviar o cadastro."; }
  finally { enviando.value = false; }
}

async function atualizarStatus() {
  if (!contaId.value) return;
  try {
    const resultado = await consultarConexao(contaId.value);
    statusConexao.value = resultado?.status || (resultado?.conectado ? "conectado" : "");
    if (["conectado", "erro", "cancelado", "desconectado"].includes(statusConexao.value)) {
      clearInterval(intervaloStatus);
      intervaloStatus = null;
    }
  } catch (e) { erroConexao.value = e.message || "Não foi possível consultar a conexão."; }
}

async function iniciarConexao() {
  erroConexao.value = "";
  if (!contaId.value) {
    erroConexao.value = "O cadastro foi concluído, mas a API não retornou o identificador da conta. Solicite apoio ao administrador.";
    return;
  }
  conectando.value = true;
  try {
    const resultado = await conectarInstagram(contaId.value);
    statusConexao.value = resultado?.status || "aguardando_login";
    await atualizarStatus();
    if (!intervaloStatus && statusConexao.value !== "conectado") intervaloStatus = setInterval(atualizarStatus, 2000);
  } catch (e) { erroConexao.value = e.message || "Não foi possível iniciar a conexão."; }
  finally { conectando.value = false; }
}

onUnmounted(() => { if (intervaloStatus) clearInterval(intervaloStatus); });
</script>

<style scoped>
.convite-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f7f7f8;font-family:inherit;color:#202124}.convite-card{width:min(100%,480px);padding:32px;border:1px solid #e2e2e5;border-radius:16px;background:#fff;box-shadow:0 12px 36px #0000000d}.marca{margin-bottom:28px;font-size:17px;font-weight:700}.marca:first-letter{color:#bd258c}.convite-card h1{margin:0 0 10px;font-size:23px}.convite-card p{color:#62646b;font-size:14px;line-height:1.6}.convite-card form{display:flex;flex-direction:column;gap:9px;margin:24px 0}.convite-card label{margin-top:8px;font-size:13px;font-weight:600}.convite-card input{width:100%;padding:12px;border:1px solid #d5d6da;border-radius:8px;font:inherit}.username{display:flex;align-items:center;border:1px solid #d5d6da;border-radius:8px;padding-left:12px}.username input{border:0}.aviso{padding:11px;border-radius:8px;background:#fff8e8;font-size:12px!important}.convite-card button{margin-top:8px;padding:13px;border:0;border-radius:8px;background:#242426;color:#fff;font-weight:600;cursor:pointer}.convite-card button:disabled{opacity:.6;cursor:wait}.status{margin:16px 0;padding:10px;border-radius:8px;background:#f2f4f7;color:#344054!important}.convite-card small{color:#777;font-size:11px;line-height:1.5}.erro{color:#b42318!important}
</style>
