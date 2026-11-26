<!--
  Equipe: administradores do mesmo espaço. Todos veem e gerenciam os mesmos
  clientes, perfis e postagens. Quem é criado aqui recebe uma senha
  provisória e cria a própria senha no primeiro acesso.
-->
<template>
  <div class="page">
    <div class="page-header">
      <h1>Equipe</h1>
      <p>
        Administradores de {{ usuario?.espaco?.nome || "este espaço" }}. Todos veem os mesmos
        clientes e postagens; administradores de outros espaços não veem nada daqui.
      </p>
    </div>

    <div class="grade">
      <section class="cartao bloco">
        <h2>Administradores</h2>

        <p v-if="msgLista.texto" class="alerta" :class="`alerta--${msgLista.tipo}`">{{ msgLista.texto }}</p>
        <p v-if="carregando" class="nota">Carregando...</p>

        <ul v-else class="lista">
          <li v-for="adm in administradores" :key="adm.id" :class="{ inativo: !adm.ativo }">
            <div class="dados">
              <strong>{{ adm.nome }}<span v-if="adm.id === usuario?.id" class="voce"> (você)</span></strong>
              <span>{{ adm.email }}</span>
              <small v-if="!adm.ativo">Desativado</small>
              <small v-else-if="adm.senhaTemporaria">Ainda não criou a própria senha</small>
            </div>
            <div v-if="adm.id !== usuario?.id" class="acoes">
              <button class="botao botao--secundario" type="button" :disabled="ocupado" @click="novaSenha(adm)">
                Nova senha
              </button>
              <button class="botao botao--secundario" type="button" :disabled="ocupado" @click="alternarAtivo(adm)">
                {{ adm.ativo ? "Desativar" : "Reativar" }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <form class="cartao bloco" novalidate @submit.prevent="criar">
        <h2>Adicionar administrador</h2>

        <p v-if="msgForm.texto" class="alerta" :class="`alerta--${msgForm.tipo}`">{{ msgForm.texto }}</p>

        <div v-if="senhaGerada" class="senha-gerada">
          <span>Senha provisória de <strong>{{ senhaGerada.email }}</strong>:</span>
          <code>{{ senhaGerada.senha }}</code>
          <small>Envie para a pessoa. Ela aparece só agora; no primeiro acesso a pessoa cria a própria senha.</small>
        </div>

        <div class="grupo-campo">
          <label for="adm-nome">Nome</label>
          <input id="adm-nome" v-model.trim="nome" class="campo" maxlength="120" :disabled="ocupado" />
        </div>

        <div class="grupo-campo">
          <label for="adm-email">E-mail</label>
          <input id="adm-email" v-model.trim="email" class="campo" type="email" maxlength="254" :disabled="ocupado" />
        </div>

        <div>
          <button class="botao botao--primario" type="submit" :disabled="ocupado || !nome || !email">
            {{ ocupado ? "Salvando..." : "Adicionar" }}
          </button>
        </div>

        <small class="nota">
          O novo administrador entra no site com esse e-mail e a senha provisória e pode usar o
          Publicador depois de criar a própria senha.
        </small>
      </form>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";

import {
  listarAdministradores,
  criarAdministrador,
  atualizarAdministrador,
  redefinirSenhaAdministrador,
} from "../api/administradores";
import { useSessao } from "../composables/useSessao";
import { useAtualizacaoAutomatica } from "../composables/useAtualizacaoAutomatica";

const { usuario } = useSessao();

const administradores = ref([]);
const carregando = ref(true);
const ocupado = ref(false);
const nome = ref("");
const email = ref("");
const senhaGerada = ref(null);
const msgLista = reactive({ tipo: "", texto: "" });
const msgForm = reactive({ tipo: "", texto: "" });

function avisar(alvo, tipo, texto) {
  alvo.tipo = tipo;
  alvo.texto = texto;
}

async function carregar() {
  try {
    administradores.value = await listarAdministradores();
  } catch (e) {
    avisar(msgLista, "erro", e.message || "Não foi possível carregar a equipe.");
  } finally {
    carregando.value = false;
  }
}

async function criar() {
  avisar(msgForm, "", "");
  senhaGerada.value = null;
  ocupado.value = true;
  try {
    const r = await criarAdministrador({ nome: nome.value, email: email.value });
    senhaGerada.value = { email: r.usuario.email, senha: r.senhaTemporaria };
    nome.value = "";
    email.value = "";
    await carregar();
  } catch (e) {
    avisar(msgForm, "erro", e.message || "Não foi possível adicionar.");
  } finally {
    ocupado.value = false;
  }
}

async function novaSenha(adm) {
  if (!window.confirm(`Gerar uma nova senha provisória para ${adm.nome}? A senha atual deixa de funcionar.`)) return;
  avisar(msgLista, "", "");
  ocupado.value = true;
  try {
    const r = await redefinirSenhaAdministrador(adm.id);
    senhaGerada.value = { email: r.usuario.email, senha: r.senhaTemporaria };
    await carregar();
  } catch (e) {
    avisar(msgLista, "erro", e.message || "Não foi possível gerar a senha.");
  } finally {
    ocupado.value = false;
  }
}

async function alternarAtivo(adm) {
  avisar(msgLista, "", "");
  ocupado.value = true;
  try {
    await atualizarAdministrador(adm.id, { ativo: !adm.ativo });
    await carregar();
  } catch (e) {
    avisar(msgLista, "erro", e.message || "Não foi possível alterar.");
  } finally {
    ocupado.value = false;
  }
}

onMounted(carregar);
useAtualizacaoAutomatica(carregar);
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

.lista {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--cor-borda, #e3e6ee);
  border-radius: 10px;
}

.lista li.inativo {
  opacity: 0.6;
}

.dados {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dados span,
.dados small {
  color: var(--cor-texto-suave);
  overflow-wrap: anywhere;
}

.voce {
  color: var(--cor-texto-suave);
  font-weight: 400;
}

.acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.senha-gerada {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: #f0f6ff;
  border: 1px solid #c7dbff;
  border-radius: 10px;
}

.senha-gerada code {
  font-size: 16px;
  font-weight: 700;
  user-select: all;
}

.nota,
.senha-gerada small {
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
