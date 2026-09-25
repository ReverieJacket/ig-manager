import { createRouter, createWebHistory } from "vue-router";

import Postagens from "../views/Postagens.vue";
import NovaPublicacao from "../views/NovaPublicacao.vue";

const routes = [
  {
    path: "/",
    redirect: "/postagens"
  },
  {
    path: "/postagens",
    name: "Postagens",
    component: Postagens
  },
  {
    path: "/criar",
    name: "Criar",
    component: NovaPublicacao
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;