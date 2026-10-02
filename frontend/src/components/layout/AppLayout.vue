<!--
  Layout principal: menu lateral fixo + área de conteúdo.
  É a rota pai do roteador; a tela atual aparece em <router-view />.
-->
<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="logo">
        <div class="logo-icon">◎</div>
        <span>IG Manager</span>
      </div>

      <nav class="navigation">
        <router-link to="/postagens" class="nav-item" active-class="active">
          <span class="nav-icon">⌂</span>
          <span>Postagens</span>
        </router-link>

        <router-link to="/contas" class="nav-item" active-class="active">
          <span class="nav-icon">◎</span>
          <span>Contas</span>
        </router-link>

        <router-link to="/criar" class="nav-item" active-class="active">
          <span class="nav-icon plus">+</span>
          <span>Criar</span>
        </router-link>
      </nav>
    </aside>

    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

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
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 42px;
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

.nav-icon.plus {
  font-size: 22px;
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
  .nav-item span:last-child {
    display: none;
  }

  .navigation {
    align-items: center;
  }

  .nav-item {
    justify-content: center;
    width: 48px;
    padding: 0;
  }

  .main-content {
    margin-left: 68px;
    padding: 30px 20px;
  }
}
</style>
