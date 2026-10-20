/**
 * Ponto de entrada do frontend: cria o app Vue, registra o roteador e
 * carrega os estilos globais.
 */
import { createApp } from "vue";

import App from "./App.vue";
import router from "./router";
import { definirAoSessaoExpirar } from "./api/cliente";
import { useSessao } from "./composables/useSessao";
import "./styles/base.css";

// Sessão expirou no meio do uso: volta ao login e, depois de entrar,
// retorna para a tela onde a pessoa estava.
definirAoSessaoExpirar(() => {
  const atual = router.currentRoute.value;
  if (atual.meta.publica) return;

  useSessao().limpar();
  router.push({ name: "login", query: { voltar: atual.fullPath } });
});

createApp(App).use(router).mount("#app");
