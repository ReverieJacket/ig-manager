<!--
  Layout principal: menu lateral fixo + área de conteúdo.
  É a rota pai do roteador; a tela atual aparece em <router-view />.
  O menu muda conforme o perfil de quem está logado.
-->
<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-icon">◎</div>
        <span>IG Manager</span>
      </div>

      <span v-if="usuario" class="perfil-tag" :class="usuario.perfil">
        {{ rotuloPerfil }}
      </span>

      <nav class="navigation">
        <router-link
          v-for="item in itensMenu"
          :key="item.para"
          :to="item.para"
          class="nav-item"
          active-class="active"
        >
          <span class="nav-icon" :class="{ plus: item.icone === '+' }">{{ item.icone }}</span>
          <span class="nav-rotulo">{{ item.rotulo }}</span>
          <span
            v-if="contadorDe(item) > 0"
            class="nav-alerta"
            :class="item.contador"
            :title="tituloContador(item)"
          >{{ contadorDe(item) }}</span>
        </router-link>
      </nav>

      <div v-if="usuario" class="usuario">
        <router-link to="/meu-perfil" class="avatar" :class="usuario.perfil" title="Meu perfil">
          {{ iniciais }}
        </router-link>
        <div class="usuario-dados">
          <strong>{{ usuario.nome }}</strong>
          <span>{{ ehAdmin ? "Administrador" : "Cliente" }}</span>
        </div>
        <button class="sair" type="button" :disabled="saindo" @click="sairDoSistema">
          Sair
        </button>
      </div>
    </aside>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { useAlertasPerfis } from "../../composables/useAlertasPerfis";
import { useAprovacoesPendentes } from "../../composables/useAprovacoesPendentes";
import { useSessao } from "../../composables/useSessao";

const router = useRouter();
const route = useRoute();
const { usuario, ehAdmin, sair } = useSessao();
const { totalEmAtencao, atualizar: atualizarAlertas } = useAlertasPerfis();
const { totalPendentes, atualizar: atualizarAprovacoes } = useAprovacoesPendentes();
const saindo = ref(false);

// Contadores do menu, conferidos a cada troca de tela (no máximo uma
// consulta a cada 30 s): perfis com sessão expirada (administrador) e
// aprovações pendentes (cliente).
watch(
  () => route.fullPath,
  () => {
    if (ehAdmin.value) atualizarAlertas();
    else atualizarAprovacoes();
  },
  { immediate: true }
);

function contadorDe(item) {
  if (item.contador === "atencao") return totalEmAtencao.value;
  if (item.contador === "aprovacoes") return totalPendentes.value;
  return 0;
}

function tituloContador(item) {
  return item.contador === "atencao"
    ? `${totalEmAtencao.value} perfil(is) com sessão expirada`
    : `${totalPendentes.value} post(s) esperando a sua resposta`;
}

const MENU_ADMIN = [
  { para: "/postagens", icone: "⌂", rotulo: "Postagens" },
  { para: "/clientes", icone: "☺", rotulo: "Clientes", contador: "atencao" },
  { para: "/criar", icone: "+", rotulo: "Criar" },
];

const MENU_CLIENTE = [
  { para: "/minhas-postagens", icone: "⌂", rotulo: "Minhas postagens" },
  { para: "/aprovacoes", icone: "✓", rotulo: "Aprovações", contador: "aprovacoes" },
  { para: "/meus-perfis", icone: "◎", rotulo: "Meus perfis" },
  { para: "/meu-perfil", icone: "☺", rotulo: "Meu perfil" },
];

const itensMenu = computed(() => (ehAdmin.value ? MENU_ADMIN : MENU_CLIENTE));

const rotuloPerfil = computed(() =>
  ehAdmin.value ? "ADMINISTRADOR" : (usuario.value?.cliente?.nome || "CLIENTE").toUpperCase()
);

const iniciais = computed(() =>
  (usuario.value?.nome || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("")
);

async function sairDoSistema() {
  saindo.value = true;
  try {
    await sair();
  } catch {
    // Mesmo se a API falhar, a sessão local já foi limpa.
  } finally {
    saindo.value = false;
    router.replace({ name: "login" });
  }
}
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: var(--cor-fundo);
}

/* Menu lateral */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 10;
  width: 230px;
  height: 100vh;
  padding: 28px 14px;
  background: var(--cor-superficie);
  border-right: 1px solid var(--cor-borda);
  display: flex;
  flex-direction: column;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 30px;
  padding: 0 12px;
  color: #171717;
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
  background: linear-gradient(135deg, #f58529, #dd2a7b, #8134af);
  color: white;
  font-size: 24px;
  font-weight: 700;
}

/* Navegação */
.navigation {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  height: 54px;
  padding: 0 18px;
  border-radius: 10px;
  color: var(--cor-texto);
  font-size: 15px;
  text-decoration: none;
  transition: background 0.15s ease;
}

.nav-item:hover {
  background: #f5f5f5;
}

.nav-item.active {
  background: #eeeeee;
  font-weight: 700;
}

.nav-icon {
  display: flex;
  justify-content: center;
  width: 18px;
  font-size: 18px;
}

.nav-alerta {
  min-width: 20px;
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 10px;
  background: #d0352a;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}

.nav-alerta.aprovacoes {
  background: #dd2a7b;
}

.nav-icon.plus {
  font-size: 22px;
}

/* Perfil e usuário logado */
.perfil-tag {
  align-self: flex-start;
  max-width: calc(100% - 24px);
  margin: 0 12px 18px;
  padding: 4px 9px;
  overflow: hidden;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.perfil-tag.admin {
  background: var(--cor-primaria);
  color: #fff;
}

.perfil-tag.cliente {
  background: #f3e8ff;
  color: #6b21a8;
}

.usuario {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  padding: 14px 12px 0;
  border-top: 1px solid #eee;
}

.avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e9e9e9;
  color: #444;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.avatar.cliente {
  background: #f3e8ff;
  color: #6b21a8;
}

.usuario-dados {
  min-width: 0;
}

.usuario-dados strong {
  display: block;
  overflow: hidden;
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.usuario-dados span {
  color: var(--cor-texto-suave);
  font-size: 12px;
}

.sair {
  margin-left: auto;
  padding: 5px 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #666;
  font-size: 12px;
  cursor: pointer;
}

.sair:hover:not(:disabled) {
  background: #f5f5f5;
}

/* Conteúdo */
.main-content {
  min-height: 100vh;
  margin-left: 230px;
  padding: 42px 50px;
}

/* Responsivo: menu recolhido (somente ícones) */
@media (max-width: 700px) {
  .sidebar {
    width: 68px;
    padding: 28px 10px;
  }

  .logo {
    justify-content: center;
    padding: 0;
  }

  .logo span,
  .nav-item .nav-rotulo,
  .perfil-tag,
  .usuario-dados {
    display: none;
  }

  .usuario {
    flex-direction: column;
    padding: 12px 0 0;
  }

  .sair {
    margin-left: 0;
  }

  .navigation {
    align-items: center;
  }

  .nav-item {
    position: relative;
    justify-content: center;
    width: 48px;
    padding: 0;
  }

  .nav-alerta {
    position: absolute;
    top: 4px;
    right: 2px;
    min-width: 16px;
    padding: 0 4px;
    font-size: 10px;
    line-height: 16px;
  }

  .main-content {
    margin-left: 68px;
    padding: 30px 20px;
  }
}
</style>
