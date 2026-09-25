<template>
  <div class="app-layout">

    <!-- NAVBAR -->
    <aside class="sidebar">

      <div class="logo">
        <div class="logo-icon">
          ◎
        </div>

        <span>IG Manager</span>
      </div>

      <nav class="navigation">

        <!-- POSTAGENS -->
        <button
          class="nav-item"
          :class="{ active: route.path === '/postagens' }"
          @click="router.push('/postagens')"
        >
          <span class="nav-icon">⌂</span>
          <span>Postagens</span>
        </button>

        <!-- CRIAR -->
        <button
          class="nav-item"
          :class="{ active: route.path === '/criar' }"
          @click="router.push('/criar')"
        >
          <span class="nav-icon plus">+</span>
          <span>Criar</span>
        </button>

      </nav>

    </aside>

    <!-- CONTEÚDO DA PÁGINA -->
    <main class="main-content">
      <slot />
    </main>

  </div>
</template>

<script setup>
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
</script>

<style scoped>

.app-layout {
  min-height: 100vh;
  background: #fafafa;
}

/* =========================
   SIDEBAR
========================= */

.sidebar {
  position: fixed;
  top: 0;
  left: 0;

  width: 230px;
  height: 100vh;

  background: #ffffff;
  border-right: 1px solid #dddddd;

  box-sizing: border-box;
  padding: 28px 14px;

  z-index: 10;
}

/* =========================
   LOGO
========================= */

.logo {
  display: flex;
  align-items: center;
  gap: 10px;

  padding: 0 12px;
  margin-bottom: 42px;

  color: #171717;
  font-size: 22px;
  font-weight: 700;
}

.logo-icon {
  width: 34px;
  height: 34px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 9px;

  background: linear-gradient(
    135deg,
    #f58529,
    #dd2a7b,
    #8134af
  );

  color: white;
  font-size: 24px;
  font-weight: 700;
}

/* =========================
   NAVEGAÇÃO
========================= */

.navigation {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  width: 100%;
  height: 54px;

  display: flex;
  align-items: center;

  gap: 18px;

  padding: 0 18px;

  border: none;
  border-radius: 10px;

  background: transparent;

  color: #222;

  font-family: inherit;
  font-size: 15px;

  cursor: pointer;

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
  width: 18px;

  display: flex;
  justify-content: center;

  font-size: 18px;
}

.nav-icon.plus {
  font-size: 22px;
}

/* =========================
   CONTEÚDO
========================= */

.main-content {
  min-height: 100vh;

  margin-left: 230px;

  box-sizing: border-box;

  padding: 42px 50px;
}

/* =========================
   RESPONSIVO
========================= */

@media (max-width: 700px) {

  .sidebar {
    width: 68px;
    padding: 28px 10px;
  }

  .logo {
    justify-content: center;
    padding: 0;
  }

  .logo span {
    display: none;
  }

  .navigation {
    align-items: center;
  }

  .nav-item {
    width: 48px;
    padding: 0;
    justify-content: center;
  }

  .nav-item span:last-child {
    display: none;
  }

  .main-content {
    margin-left: 68px;
    padding: 30px 20px;
  }
}

</style>