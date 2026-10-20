/**
 * Rotas do frontend.
 *
 * `AppLayout` (menu lateral) é a rota pai: as telas são renderizadas
 * dentro dele, então o layout é montado uma única vez em vez de ser
 * repetido em cada tela. As views são carregadas sob demanda
 * (code splitting) para reduzir o tamanho do carregamento inicial.
 *
 * Acesso:
 * - `meta.publica`: abre sem login (login e link de convite).
 * - `meta.perfil`: só para esse perfil; o outro perfil é levado à
 *   própria tela inicial.
 * - Demais rotas exigem login.
 *
 * A proteção de verdade está no backend; aqui é só navegação.
 */
import { createRouter, createWebHistory } from "vue-router";

import AppLayout from "../components/layout/AppLayout.vue";
import { PERFIS, rotaInicial, useSessao } from "../composables/useSessao";

const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue"),
    meta: { titulo: "Entrar", publica: true },
  },
  {
    path: "/cadastro-conta/:token",
    name: "cadastro-conta",
    component: () => import("../views/CadastroContaConviteView.vue"),
    meta: { titulo: "Cadastro de conta Instagram", publica: true },
  },
  {
    path: "/",
    component: AppLayout,
    redirect: () => rotaInicial(useSessao().usuario.value?.perfil),
    children: [
      {
        path: "postagens",
        name: "postagens",
        component: () => import("../views/PostagensView.vue"),
        meta: { titulo: "Postagens", perfil: PERFIS.ADMIN },
      },
      {
        path: "contas",
        name: "contas",
        component: () => import("../views/ContasView.vue"),
        meta: { titulo: "Contas", perfil: PERFIS.ADMIN },
      },
      {
        path: "criar",
        name: "criar",
        component: () => import("../views/NovaPublicacaoView.vue"),
        meta: { titulo: "Criar", perfil: PERFIS.ADMIN },
      },
      {
        path: "cliente",
        name: "cliente-inicio",
        component: () => import("../views/ClienteInicioView.vue"),
        meta: { titulo: "Minhas postagens", perfil: PERFIS.CLIENTE },
      },
    ],
  },
  { path: "/:caminho(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const sessao = useSessao();
  let usuario = null;

  try {
    usuario = await sessao.carregar();
  } catch {
    // Backend fora do ar: as telas públicas ainda abrem; as demais vão
    // para o login, que mostra o erro de conexão ao tentar entrar.
  }

  if (to.meta.publica) {
    // Quem já está logado não precisa ver o login de novo.
    return to.name === "login" && usuario ? rotaInicial(usuario.perfil) : true;
  }

  if (!usuario) {
    return { name: "login", query: to.fullPath !== "/" ? { voltar: to.fullPath } : {} };
  }

  if (to.meta.perfil && to.meta.perfil !== usuario.perfil) {
    return rotaInicial(usuario.perfil);
  }

  return true;
});

router.afterEach((to) => {
  document.title = to.meta.titulo ? `${to.meta.titulo} · IG Manager` : "IG Manager";
});

export default router;
