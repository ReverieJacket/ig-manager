/**
 * Rotas do frontend.
 *
 * `AppLayout` (menu lateral) é a rota pai: as telas são renderizadas
 * dentro dele, então o layout é montado uma única vez em vez de ser
 * repetido em cada tela. As views são carregadas sob demanda
 * (code splitting) para reduzir o tamanho do carregamento inicial.
 */
import { createRouter, createWebHistory } from "vue-router";

import AppLayout from "../components/layout/AppLayout.vue";

const routes = [
  {
    path: "/cadastro-conta/:token",
    name: "cadastro-conta",
    component: () => import("../views/CadastroContaConviteView.vue"),
    meta: { titulo: "Cadastro de conta Instagram" },
  },
  {
    path: "/",
    component: AppLayout,
    redirect: "/postagens",
    children: [
      {
        path: "postagens",
        name: "postagens",
        component: () => import("../views/PostagensView.vue"),
        meta: { titulo: "Postagens" },
      },
      {
        path: "contas",
        name: "contas",
        component: () => import("../views/ContasView.vue"),
        meta: { titulo: "Contas" },
      },
      {
        path: "criar",
        name: "criar",
        component: () => import("../views/NovaPublicacaoView.vue"),
        meta: { titulo: "Criar" },
      },
    ],
  },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
