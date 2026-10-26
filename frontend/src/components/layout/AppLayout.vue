<!--
  Layout principal: menu lateral fixo + área de conteúdo.
  É a rota pai do roteador; a tela atual aparece em <router-view />.
  O menu muda conforme o perfil de quem está logado.

  Celular/tablet (até 900px): o menu lateral vira uma gaveta que abre pelo
  botão ☰ da barra do topo e fecha ao escolher uma tela.
-->
<template>
  <div class="app-layout" :class="{ 'menu-aberto': menuAberto }">
    <header class="barra-topo">
      <button
        class="botao-menu"
        type="button"
        :aria-expanded="menuAberto"
        aria-controls="menu-lateral"
        :aria-label="menuAberto ? 'Fechar menu' : 'Abrir menu'"
        @click="menuAberto = !menuAberto"
      >
        <span class="hamburguer" aria-hidden="true"></span>
        <span v-if="totalAlertas > 0 && !menuAberto" class="ponto-alerta" aria-hidden="true"></span>
      </button>
      <div class="logo logo--topo">
        <div class="logo-icon">◎</div>
        <span>IG Manager</span>
      </div>
      <router-link to="/meu-perfil" class="avatar avatar--topo" :class="usuario?.perfil" title="Meu perfil">
        {{ iniciais }}
      </router-link>
    </header>

    <div class="veu" aria-hidden="true" @click="menuAberto = false"></div>

    <aside id="menu-lateral" class="sidebar">
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

// Gaveta do menu no celular: fecha sempre que a tela muda.
const menuAberto = ref(false);
watch(
  () => route.fullPath,
  () => {
    menuAberto.value = false;
  }
);

/** Algum contador do menu ativo (ponto vermelho no botão ☰). */
const totalAlertas = computed(() =>
  ehAdmin.value ? totalEmAtencao.value : totalPendentes.value
);

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

/* Barra do topo e véu: só no celular/tablet */
.barra-topo,
.veu {
  display: none;
}

@media (max-width: 900px) {
  .barra-topo {
    position: fixed;
    top: 0;
    right: 0;
    left: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 56px;
    padding: 0 14px;
    border-bottom: 1px solid var(--cor-borda);
    background: var(--cor-superficie);
  }

  .logo--topo {
    flex: 1;
    margin: 0;
    padding: 0;
    font-size: 18px;
  }

  .logo--topo .logo-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    font-size: 18px;
  }

  .avatar--topo {
    width: 34px;
    height: 34px;
    font-size: 12px;
  }

  .botao-menu {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--cor-borda);
    border-radius: 10px;
    background: #fff;
    cursor: pointer;
  }

  .hamburguer,
  .hamburguer::before,
  .hamburguer::after {
    display: block;
    width: 18px;
    height: 2px;
    border-radius: 2px;
    background: #222;
    transition: transform 0.2s ease, background 0.2s ease;
  }

  .hamburguer {
    position: relative;
  }

  .hamburguer::before,
  .hamburguer::after {
    position: absolute;
    left: 0;
    content: "";
  }

  .hamburguer::before {
    top: -6px;
  }

  .hamburguer::after {
    top: 6px;
  }

  .menu-aberto .hamburguer {
    background: transparent;
  }

  .menu-aberto .hamburguer::before {
    transform: translateY(6px) rotate(45deg);
  }

  .menu-aberto .hamburguer::after {
    transform: translateY(-6px) rotate(-45deg);
  }

  .ponto-alerta {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 9px;
    height: 9px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: #d0352a;
  }

  /* A barra lateral vira gaveta */
  .sidebar {
    top: 56px;
    z-index: 30;
    width: min(280px, 82vw);
    height: calc(100vh - 56px);
    height: calc(100dvh - 56px);
    padding: 18px 14px;
    overflow-y: auto;
    box-shadow: 8px 0 30px rgba(0, 0, 0, 0.12);
    transform: translateX(-105%);
    transition: transform 0.22s ease;
  }

  .menu-aberto .sidebar {
    transform: translateX(0);
  }

  .sidebar > .logo {
    display: none;
  }

  .veu {
    position: fixed;
    inset: 56px 0 0;
    z-index: 25;
    display: block;
    background: rgba(17, 24, 39, 0.35);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }

  .menu-aberto .veu {
    opacity: 1;
    pointer-events: auto;
  }

  .nav-item {
    height: 50px;
  }

  .main-content {
    margin-left: 0;
    padding: 80px 18px 32px;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 72px 14px 28px;
  }
}
</style>
