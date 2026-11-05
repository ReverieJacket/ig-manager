<!--
  Clientes (administrador): tudo o que é de um cliente num lugar só.

  - Coluna da esquerda: clientes com busca e uma bolinha de situação.
  - Detalhe com duas abas: "Perfis do Instagram" e "Usuários".
  - Cada linha mostra só a ação principal; as demais ficam no menu "⋯".

  Senhas: o administrador nunca define nem vê a senha de um cliente. Ao
  criar um usuário ou redefinir a senha, o sistema gera uma senha
  temporária, mostrada UMA vez; no primeiro acesso o cliente cria a dele.
-->
<template>
  <div class="page">
    <div class="page-header cabecalho">
      <h1>Clientes</h1>
      <button class="botao botao--primario" type="button" @click="abrirNovoCliente">+ Novo cliente</button>
    </div>

    <div class="colunas" :class="{ 'mostrar-detalhe': detalheNoCelular }">
      <!-- ============================ Lista ============================ -->
      <section class="cartao lista">
        <div class="lista-topo">
          <input v-model.trim="busca" class="campo busca" type="search" placeholder="Buscar cliente" aria-label="Buscar cliente" />
        </div>

        <div v-if="carregandoLista" class="estado-vazio">Carregando...</div>
        <div v-else-if="erroLista" class="estado-vazio">
          <strong>Não foi possível carregar</strong>
          <span>{{ erroLista }}</span>
          <button class="botao botao--secundario botao--pequeno" type="button" @click="carregarLista">Tentar novamente</button>
        </div>
        <div v-else-if="clientesVisiveis.length === 0" class="estado-vazio">
          <strong>{{ busca ? "Nenhum cliente encontrado" : "Nenhum cliente" }}</strong>
          <span v-if="!busca">Crie o primeiro com "+ Novo cliente".</span>
        </div>

        <template v-else>
          <button
            v-for="c in clientesVisiveis"
            :key="c.id"
            type="button"
            class="item-cliente"
            :class="{ selecionado: c.id === selecionadoId, inativo: !c.ativo }"
            @click="abrirCliente(c.id)"
          >
            <span class="item-dados">
              <strong>{{ c.nome }}</strong>
              <small>{{ c.ativo ? plural(c.totalContas, "perfil", "perfis", "nenhum perfil") : "desativado" }}</small>
            </span>
            <span class="ponto" :class="pontoCliente(c).classe" :title="pontoCliente(c).titulo"></span>
          </button>
        </template>

        <div class="lista-rodape">
          <span class="legenda"><i class="ponto ok"></i>em dia</span>
          <span class="legenda"><i class="ponto aviso"></i>aguardando</span>
          <span class="legenda"><i class="ponto erro"></i>atenção</span>
          <label class="mostrar-inativos">
            <input v-model="mostrarInativos" type="checkbox" />
            Desativados
          </label>
        </div>
      </section>

      <!-- ============================ Detalhe ============================ -->
      <section class="cartao detalhe">
        <div v-if="!selecionadoId" class="estado-vazio">
          <strong>Selecione um cliente</strong>
          <span>Os perfis do Instagram e os usuários aparecem aqui.</span>
        </div>
        <div v-else-if="carregandoDetalhe && !detalhe" class="estado-vazio">Carregando...</div>
        <div v-else-if="erroDetalhe" class="estado-vazio">
          <strong>Não foi possível carregar o cliente</strong>
          <span>{{ erroDetalhe }}</span>
        </div>

        <template v-else-if="detalhe">
          <button class="voltar-lista" type="button" @click="detalheNoCelular = false">← Clientes</button>

          <div class="detalhe-topo">
            <div>
              <h2>{{ detalhe.cliente.nome }}</h2>
              <p class="meta">
                <span :class="detalhe.cliente.ativo ? '' : 'txt-erro'">{{ detalhe.cliente.ativo ? "Ativo" : "Desativado" }}</span>
                · cliente desde {{ formatarDia(detalhe.cliente.criadoEm) }}
              </p>
            </div>
            <MenuAcoes grande rotulo="Ações do cliente" :itens="acoesCliente" />
          </div>

          <p v-if="!detalhe.cliente.ativo" class="alerta alerta--aviso faixa">
            Cliente desativado: nenhum usuário dele consegue entrar e os perfis não aparecem em "Criar".
          </p>

          <nav class="abas" role="tablist">
            <button type="button" role="tab" :aria-selected="aba === 'perfis'" :class="{ ativa: aba === 'perfis' }" @click="aba = 'perfis'">
              Perfis do Instagram <span class="contagem">{{ detalhe.contas.length }}</span>
              <i v-if="perfisExpirados > 0" class="ponto erro" title="Precisa de atenção"></i>
            </button>
            <button type="button" role="tab" :aria-selected="aba === 'usuarios'" :class="{ ativa: aba === 'usuarios' }" @click="aba = 'usuarios'">
              Usuários <span class="contagem">{{ detalhe.usuarios.length }}</span>
            </button>
          </nav>

          <!-- ------------------------- Aba: Perfis ------------------------- -->
          <div v-if="aba === 'perfis'" class="aba-conteudo">
            <div class="barra">
              <button class="botao botao--secundario botao--pequeno" type="button" :disabled="!detalhe.cliente.ativo" @click="abrirLink">
                ↗ Link para o cliente
              </button>
              <button class="botao botao--primario botao--pequeno" type="button" :disabled="!detalhe.cliente.ativo" @click="abrirAdicionarPerfil">
                + Adicionar perfil
              </button>
            </div>

            <div v-if="detalhe.contas.length === 0" class="vazio-aba">
              Nenhum perfil ainda. Adicione um aqui ou envie o link para o cliente informar o @.
            </div>

            <ul v-else class="linhas">
              <li v-for="perfil in detalhe.contas" :key="perfil.id" class="linha">
                <div class="avatar-ig" aria-hidden="true">{{ iniciais(perfil.nome || perfil.username) }}</div>

                <div class="info">
                  <strong>@{{ perfil.username }}</strong>
                  <span v-if="perfil.status === 'expirada'" class="txt-erro">
                    Expirou em {{ formatarDia(perfil.sessaoExpiradaEm) }} — as publicações neste perfil estão paradas
                  </span>
                  <span v-else-if="emAndamento(perfil.id)" class="txt-info">{{ conexao[perfil.id]?.mensagem }}</span>
                  <span v-else-if="conexao[perfil.id]?.status === 'erro'" class="txt-erro">{{ conexao[perfil.id].mensagem }}</span>
                  <span v-else>{{ perfil.nome }}</span>
                </div>

                <span class="estado"><i class="ponto" :class="estadoPerfil(perfil).classe"></i>{{ estadoPerfil(perfil).rotulo }}</span>

                <div class="acao-principal">
                  <button
                    v-if="perfil.status !== 'conectado'"
                    class="botao botao--primario botao--pequeno"
                    type="button"
                    :disabled="emAndamento(perfil.id) || !detalhe.cliente.ativo"
                    @click="conectar(perfil)"
                  >
                    {{ emAndamento(perfil.id) ? "Aguardando login..." : perfil.status === "expirada" ? "Reconectar" : "Conectar" }}
                  </button>
                </div>

                <MenuAcoes :itens="acoesPerfil(perfil)" :rotulo="`Ações de @${perfil.username}`" />
              </li>
            </ul>
          </div>

          <!-- ------------------------ Aba: Usuários ------------------------ -->
          <div v-else class="aba-conteudo">
            <div class="barra">
              <button class="botao botao--primario botao--pequeno" type="button" :disabled="!detalhe.cliente.ativo" @click="abrirAdicionarUsuario">
                + Adicionar usuário
              </button>
            </div>

            <div v-if="detalhe.usuarios.length === 0" class="vazio-aba">
              Nenhum usuário. Adicione um para o cliente poder entrar no sistema.
            </div>

            <ul v-else class="linhas">
              <li v-for="u in detalhe.usuarios" :key="u.id" class="linha" :class="{ apagada: !u.ativo }">
                <div class="avatar-pessoa" aria-hidden="true">{{ iniciais(u.nome) }}</div>
                <div class="info">
                  <strong>{{ u.nome }}</strong>
                  <span>{{ u.email }} · {{ u.ultimoAcesso ? `último acesso ${formatarData(u.ultimoAcesso)}` : "ainda não entrou" }}</span>
                </div>
                <span class="estado"><i class="ponto" :class="estadoUsuario(u).classe"></i>{{ estadoUsuario(u).rotulo }}</span>
                <MenuAcoes :itens="acoesUsuario(u)" :rotulo="`Ações de ${u.nome}`" />
              </li>
            </ul>
          </div>
        </template>
      </section>
    </div>

    <!-- ============================ Modais ============================ -->

    <!-- Novo cliente -->
    <ModalBase
      v-if="modal?.tipo === 'novoCliente'"
      titulo="Novo cliente"
      subtitulo="Crie o cliente e o primeiro usuário de acesso. A senha temporária é gerada pelo sistema."
      :travada="salvando"
      @fechar="fecharModal"
    >
      <p v-if="erroModal" class="alerta alerta--erro">{{ erroModal }}</p>
      <div class="grupo-campo">
        <label for="nc-cliente">Nome do cliente</label>
        <input id="nc-cliente" v-model.trim="form.cliente" class="campo" maxlength="120" placeholder="Ex.: Padaria Bella Massa" />
      </div>
      <div class="grupo-campo">
        <label for="nc-nome">Nome da pessoa</label>
        <input id="nc-nome" v-model.trim="form.nome" class="campo" maxlength="120" placeholder="Quem vai acessar o sistema" />
      </div>
      <div class="grupo-campo">
        <label for="nc-email">E-mail de acesso</label>
        <input id="nc-email" v-model.trim="form.email" class="campo" type="email" maxlength="254" />
      </div>
      <template #rodape>
        <button class="botao botao--secundario" type="button" :disabled="salvando" @click="fecharModal">Cancelar</button>
        <button class="botao botao--primario" type="button" :disabled="salvando" @click="salvarNovoCliente">
          {{ salvando ? "Criando..." : "Criar cliente" }}
        </button>
      </template>
    </ModalBase>

    <!-- Adicionar perfil -->
    <ModalBase
      v-if="modal?.tipo === 'adicionarPerfil'"
      titulo="Adicionar perfil"
      :subtitulo="`Novo perfil do Instagram para ${detalhe?.cliente.nome}. Depois é só clicar em Conectar.`"
      :travada="salvando"
      @fechar="fecharModal"
    >
      <p v-if="erroModal" class="alerta alerta--erro">{{ erroModal }}</p>
      <div class="grupo-campo">
        <label for="ap-nome">Nome do perfil</label>
        <input id="ap-nome" v-model.trim="form.nome" class="campo" maxlength="120" placeholder="Ex.: Bella Massa Delivery" />
      </div>
      <div class="grupo-campo">
        <label for="ap-user">Usuário do Instagram</label>
        <div class="arroba">
          <span aria-hidden="true">@</span>
          <input id="ap-user" v-model.trim="form.username" class="campo" maxlength="31" autocomplete="off" />
        </div>
      </div>
      <template #rodape>
        <button class="botao botao--secundario" type="button" :disabled="salvando" @click="fecharModal">Cancelar</button>
        <button class="botao botao--primario" type="button" :disabled="salvando" @click="salvarPerfil">
          {{ salvando ? "Adicionando..." : "Adicionar perfil" }}
        </button>
      </template>
    </ModalBase>

    <!-- Link para o cliente -->
    <ModalBase
      v-if="modal?.tipo === 'link'"
      titulo="Link para o cliente"
      :subtitulo="`${detalhe?.cliente.nome} informa o @ do Instagram por este link — sem login e sem senha.`"
      :largura="580"
      :travada="salvando"
      @fechar="fecharModal"
    >
      <p v-if="erroModal" class="alerta alerta--erro">{{ erroModal }}</p>

      <div class="grupo-campo">
        <label>Validade do link</label>
        <div class="chips">
          <button
            v-for="op in VALIDADES"
            :key="op.horas"
            type="button"
            class="chip"
            :class="{ selecionado: modal.validade === op.horas }"
            :disabled="salvando"
            @click="gerarLink(op.horas)"
          >
            {{ op.rotulo }}
          </button>
        </div>
      </div>

      <div v-if="modal.url" class="grupo-campo">
        <label>Link gerado</label>
        <div class="caixa-copiar">
          <code>{{ modal.url }}</code>
          <button class="botao botao--secundario botao--pequeno" type="button" @click="copiar(modal.url, 'link')">
            {{ copiado === "link" ? "Copiado ✓" : "Copiar" }}
          </button>
        </div>
        <small>
          Uso único · expira em {{ formatarData(modal.expiraEm) }}. O perfil cadastrado entra direto
          neste cliente como <strong>Aguardando conexão</strong>.
        </small>
      </div>
      <p v-else-if="salvando" class="carregando-link">Gerando link...</p>

      <p class="alerta alerta--aviso">
        O link só serve para <strong>informar o perfil</strong>. A conexão com o Instagram continua sendo
        feita por você, com o botão <strong>Conectar</strong>.
      </p>

      <template #rodape>
        <button class="botao botao--secundario" type="button" :disabled="!modal.url" @click="copiar(mensagemLink, 'mensagem')">
          {{ copiado === "mensagem" ? "Mensagem copiada ✓" : "Copiar mensagem pronta" }}
        </button>
        <button class="botao botao--primario" type="button" :disabled="salvando" @click="fecharModal">Concluir</button>
      </template>
    </ModalBase>

    <!-- Adicionar usuário -->
    <ModalBase
      v-if="modal?.tipo === 'adicionarUsuario'"
      titulo="Adicionar usuário"
      :subtitulo="`Novo acesso para ${detalhe?.cliente.nome}. A senha temporária é gerada pelo sistema.`"
      :travada="salvando"
      @fechar="fecharModal"
    >
      <p v-if="erroModal" class="alerta alerta--erro">{{ erroModal }}</p>
      <div class="grupo-campo">
        <label for="au-nome">Nome da pessoa</label>
        <input id="au-nome" v-model.trim="form.nome" class="campo" maxlength="120" />
      </div>
      <div class="grupo-campo">
        <label for="au-email">E-mail de acesso</label>
        <input id="au-email" v-model.trim="form.email" class="campo" type="email" maxlength="254" />
      </div>
      <template #rodape>
        <button class="botao botao--secundario" type="button" :disabled="salvando" @click="fecharModal">Cancelar</button>
        <button class="botao botao--primario" type="button" :disabled="salvando" @click="salvarNovoUsuario">
          {{ salvando ? "Adicionando..." : "Adicionar" }}
        </button>
      </template>
    </ModalBase>

    <!-- Campo único: renomear cliente, editar nome do perfil, alterar e-mail -->
    <ModalBase
      v-if="modal?.tipo === 'campo'"
      :titulo="modal.titulo"
      :subtitulo="modal.subtitulo"
      :travada="salvando"
      @fechar="fecharModal"
    >
      <p v-if="erroModal" class="alerta alerta--erro">{{ erroModal }}</p>
      <div class="grupo-campo">
        <label for="campo-unico">{{ modal.rotulo }}</label>
        <input id="campo-unico" v-model.trim="form.valor" class="campo" :type="modal.tipoCampo || 'text'" maxlength="254" />
      </div>
      <template #rodape>
        <button class="botao botao--secundario" type="button" :disabled="salvando" @click="fecharModal">Cancelar</button>
        <button class="botao botao--primario" type="button" :disabled="salvando || !form.valor" @click="salvarCampo">
          {{ salvando ? "Salvando..." : "Salvar" }}
        </button>
      </template>
    </ModalBase>

    <!-- Confirmação genérica -->
    <ModalBase v-if="modal?.tipo === 'confirmar'" :titulo="modal.titulo" :travada="salvando" @fechar="fecharModal">
      <p v-if="erroModal" class="alerta alerta--erro">{{ erroModal }}</p>
      <p class="texto-confirmar">{{ modal.texto }}</p>
      <template #rodape>
        <button class="botao botao--secundario" type="button" :disabled="salvando" @click="fecharModal">Cancelar</button>
        <button
          class="botao"
          :class="modal.perigo ? 'botao--perigo' : 'botao--primario'"
          type="button"
          :disabled="salvando"
          @click="executarConfirmacao"
        >
          {{ salvando ? "Aguarde..." : modal.botao }}
        </button>
      </template>
    </ModalBase>

    <!-- Excluir cliente (definitivo) -->
    <ModalBase
      v-if="modal?.tipo === 'excluir'"
      titulo="Excluir cliente"
      subtitulo="Esta ação é permanente e não pode ser desfeita."
      :travada="salvando"
      @fechar="fecharModal"
    >
      <p v-if="erroModal" class="alerta alerta--erro">{{ erroModal }}</p>
      <div class="resumo-exclusao">
        <p>Serão apagados de vez:</p>
        <ul>
          <li>o cliente <strong>{{ modal.nome }}</strong>;</li>
          <li>{{ plural(modal.usuarios, "usuário de acesso", "usuários de acesso") }} (perdem o login na hora);</li>
          <li>{{ plural(modal.contas, "perfil do Instagram", "perfis do Instagram") }}<template v-if="modal.contas"> e as sessões conectadas deles</template>.</li>
        </ul>
        <p class="nota-exclusao">
          Se algum perfil já tiver publicações, a exclusão é bloqueada para preservar o histórico.
          Nesse caso, use <strong>Desativar cliente</strong>.
        </p>
      </div>
      <div class="grupo-campo">
        <label for="ex-nome">Para confirmar, digite o nome do cliente: <strong>{{ modal.nome }}</strong></label>
        <input id="ex-nome" v-model="form.valor" class="campo" autocomplete="off" :disabled="salvando" />
      </div>
      <template #rodape>
        <button class="botao botao--secundario" type="button" :disabled="salvando" @click="fecharModal">Cancelar</button>
        <button class="botao botao--perigo" type="button" :disabled="salvando || form.valor.trim() !== modal.nome" @click="executarExclusao">
          {{ salvando ? "Excluindo..." : "Excluir definitivamente" }}
        </button>
      </template>
    </ModalBase>

    <!-- Senha temporária (resultado) -->
    <ModalBase v-if="modal?.tipo === 'senha'" :titulo="modal.titulo" subtitulo="Repasse os dados de acesso ao cliente." @fechar="fecharModal">
      <p class="alerta alerta--sucesso">✓ {{ modal.resumo }}</p>
      <div class="grupo-campo">
        <label>Senha temporária</label>
        <div class="caixa-copiar">
          <code class="senha">{{ modal.senha }}</code>
          <button class="botao botao--secundario botao--pequeno" type="button" @click="copiar(modal.senha, 'senha')">
            {{ copiado === "senha" ? "Copiada ✓" : "Copiar" }}
          </button>
        </div>
      </div>
      <p class="alerta alerta--aviso">
        <strong>Esta senha aparece só agora.</strong> Envie para o cliente junto com o endereço do sistema.
        No primeiro acesso ele será obrigado a criar uma senha própria. Se perder, use "Redefinir senha".
      </p>
      <template #rodape>
        <button class="botao botao--secundario" type="button" @click="copiar(mensagemSenha, 'mensagem')">
          {{ copiado === "mensagem" ? "Mensagem copiada ✓" : "Copiar mensagem pronta" }}
        </button>
        <button class="botao botao--primario" type="button" @click="fecharModal">Concluir</button>
      </template>
    </ModalBase>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";

import MenuAcoes from "../components/comum/MenuAcoes.vue";
import ModalBase from "../components/comum/ModalBase.vue";
import {
  adicionarUsuario,
  atualizarCliente,
  atualizarUsuario,
  buscarCliente,
  criarCliente,
  excluirCliente,
  listarClientes,
  redefinirSenha,
} from "../api/clientes";
import { conectarInstagram, consultarConexao, desconectarInstagram } from "../api/contas";
import { adicionarPerfil, gerarLinkCliente, removerPerfil, renomearPerfil } from "../api/perfis";
import { useAlertasPerfis } from "../composables/useAlertasPerfis";
import { formatarData } from "../utils/formatadores";

const VALIDADES = [
  { horas: 24, rotulo: "24 horas" },
  { horas: 72, rotulo: "3 dias" },
  { horas: 168, rotulo: "7 dias" },
];

const alertas = useAlertasPerfis();

/* ================================ lista ================================ */

const clientes = ref([]);
const carregandoLista = ref(true);
const erroLista = ref("");
const busca = ref("");
const mostrarInativos = ref(false);
const selecionadoId = ref(null);

const clientesVisiveis = computed(() => {
  const termo = busca.value.toLowerCase();
  return clientes.value.filter(
    (c) =>
      (mostrarInativos.value || c.ativo || c.id === selecionadoId.value) &&
      (!termo || c.nome.toLowerCase().includes(termo))
  );
});

async function carregarLista() {
  carregandoLista.value = true;
  erroLista.value = "";
  try {
    clientes.value = await listarClientes();
    if (!selecionadoId.value) {
      const primeiro = clientes.value.find((c) => c.ativo);
      if (primeiro) selecionar(primeiro.id);
    }
  } catch (e) {
    erroLista.value = e.message;
  } finally {
    carregandoLista.value = false;
  }
}

/* =============================== detalhe =============================== */

const detalhe = ref(null);
const carregandoDetalhe = ref(false);
const erroDetalhe = ref("");
const aba = ref("perfis");

const perfisExpirados = computed(() => (detalhe.value?.contas || []).filter((p) => p.status === "expirada").length);

async function carregarDetalhe() {
  if (!selecionadoId.value) return;
  carregandoDetalhe.value = true;
  erroDetalhe.value = "";
  try {
    detalhe.value = await buscarCliente(selecionadoId.value);
  } catch (e) {
    erroDetalhe.value = e.message;
  } finally {
    carregandoDetalhe.value = false;
  }
}

/**
 * Celular/tablet: a lista e o detalhe não cabem lado a lado. Tocar num
 * cliente mostra o detalhe; "← Clientes" volta para a lista.
 */
const detalheNoCelular = ref(false);

function abrirCliente(id) {
  selecionar(id);
  detalheNoCelular.value = true;
  window.scrollTo({ top: 0 });
}

function selecionar(id) {
  if (selecionadoId.value === id) return;
  selecionadoId.value = id;
  detalhe.value = null;
  aba.value = "perfis";
  carregarDetalhe();
}

/** Recarrega detalhe, contadores da lista e o aviso do menu. */
async function recarregar() {
  await Promise.all([
    carregarDetalhe(),
    listarClientes().then((l) => { clientes.value = l; }).catch(() => {}),
    alertas.atualizar({ forcar: true }),
  ]);
}

/* =============================== formatos =============================== */

function plural(n, um, varios, nenhum) {
  if (n === 0 && nenhum) return nenhum;
  return `${n} ${n === 1 ? um : varios}`;
}

function iniciais(texto) {
  return String(texto || "")
    .replace(/^@/, "")
    .split(/[\s._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function formatarDia(data) {
  return data ? new Date(data).toLocaleDateString("pt-BR") : "—";
}

function pontoCliente(c) {
  if (!c.ativo) return { classe: "cinza", titulo: "Desativado" };
  if (c.contasExpiradas) return { classe: "erro", titulo: "Perfil com sessão expirada" };
  if (c.contasAguardando || c.primeiroAcessoPendente) return { classe: "aviso", titulo: "Aguardando conexão ou 1º acesso" };
  if (c.totalContas === 0) return { classe: "cinza", titulo: "Nenhum perfil" };
  return { classe: "ok", titulo: "Em dia" };
}

function estadoPerfil(perfil) {
  if (perfil.status === "expirada") return { rotulo: "Sessão expirada", classe: "erro" };
  if (emAndamento(perfil.id)) return { rotulo: "Conectando", classe: "info" };
  if (perfil.status === "conectado") return { rotulo: "Conectado", classe: "ok" };
  return { rotulo: "Aguardando conexão", classe: "aviso" };
}

function estadoUsuario(u) {
  if (!u.ativo) return { rotulo: "Desativado", classe: "cinza" };
  if (u.senhaTemporaria) return { rotulo: "1º acesso pendente", classe: "aviso" };
  return { rotulo: "Ativo", classe: "ok" };
}

/* ============================ menus de ações ============================ */

const acoesCliente = computed(() => {
  if (!detalhe.value) return [];
  const ativo = detalhe.value.cliente.ativo;
  return [
    { rotulo: "Renomear cliente", acao: abrirRenomear },
    { rotulo: ativo ? "Desativar cliente" : "Reativar cliente", acao: () => confirmarCliente(!ativo) },
    { rotulo: "🗑 Excluir cliente", acao: abrirExcluir, perigo: true, separadorAntes: true },
  ];
});

function acoesPerfil(perfil) {
  return [
    {
      rotulo: "Desconectar",
      acao: () => confirmarDesconectar(perfil),
      desabilitado: perfil.status === "aguardando",
    },
    { rotulo: "Editar nome", acao: () => abrirEditarPerfil(perfil) },
    { rotulo: "Remover perfil", acao: () => confirmarRemoverPerfil(perfil), perigo: true, separadorAntes: true },
  ];
}

function acoesUsuario(u) {
  if (!u.ativo) {
    return [{ rotulo: "Reativar acesso", acao: () => confirmarUsuario(u, true) }];
  }
  return [
    { rotulo: "Redefinir senha", acao: () => confirmarRedefinir(u) },
    { rotulo: "Alterar e-mail", acao: () => abrirAlterarEmail(u) },
    { rotulo: "Desativar acesso", acao: () => confirmarUsuario(u, false), perigo: true, separadorAntes: true },
  ];
}

/* ================================ modais ================================ */

const modal = ref(null);
const form = reactive({ cliente: "", nome: "", email: "", username: "", valor: "" });
const salvando = ref(false);
const erroModal = ref("");
const copiado = ref("");

function abrir(dados) {
  erroModal.value = "";
  copiado.value = "";
  modal.value = dados;
}

function fecharModal() {
  if (!salvando.value) modal.value = null;
}

/** Executa a ação de um modal mostrando o erro dentro dele. */
async function comModal(acao) {
  salvando.value = true;
  erroModal.value = "";
  try {
    await acao();
  } catch (e) {
    erroModal.value = e.message || "Não foi possível concluir.";
  } finally {
    salvando.value = false;
  }
}

async function copiar(texto, qual) {
  try {
    await navigator.clipboard.writeText(texto);
    copiado.value = qual;
    setTimeout(() => { if (copiado.value === qual) copiado.value = ""; }, 2000);
  } catch {
    copiado.value = "";
  }
}

/* ---- novo cliente / usuário (senha temporária) ---- */

function mostrarSenha({ titulo, resumo, usuario, senha }) {
  abrir({ tipo: "senha", titulo, resumo, nome: usuario.nome, email: usuario.email, senha });
}

const mensagemSenha = computed(() => {
  if (modal.value?.tipo !== "senha") return "";
  const { nome, email, senha } = modal.value;
  return [
    `Olá, ${String(nome || "").split(" ")[0]}! Seu acesso ao IG Manager está pronto.`,
    "",
    `Endereço: ${window.location.origin}/login`,
    `E-mail: ${email}`,
    `Senha temporária: ${senha}`,
    "",
    "No primeiro acesso você vai criar uma senha só sua.",
  ].join("\n");
});

function abrirNovoCliente() {
  Object.assign(form, { cliente: "", nome: "", email: "" });
  abrir({ tipo: "novoCliente" });
}

function salvarNovoCliente() {
  return comModal(async () => {
    const r = await criarCliente({ nome: form.cliente, usuario: { nome: form.nome, email: form.email } });
    await carregarLista();
    selecionadoId.value = null;
    abrirCliente(r.cliente.id);
    mostrarSenha({
      titulo: "Cliente criado",
      resumo: `${r.cliente.nome} foi criado com o usuário ${r.usuario.email}.`,
      usuario: r.usuario,
      senha: r.senhaTemporaria,
    });
  });
}

function abrirAdicionarUsuario() {
  Object.assign(form, { nome: "", email: "" });
  abrir({ tipo: "adicionarUsuario" });
}

function salvarNovoUsuario() {
  return comModal(async () => {
    const r = await adicionarUsuario(selecionadoId.value, { nome: form.nome, email: form.email });
    await recarregar();
    mostrarSenha({
      titulo: "Usuário adicionado",
      resumo: `${r.usuario.nome} (${r.usuario.email}) agora tem acesso.`,
      usuario: r.usuario,
      senha: r.senhaTemporaria,
    });
  });
}

/* ---- perfis ---- */

function abrirAdicionarPerfil() {
  Object.assign(form, { nome: "", username: "" });
  abrir({ tipo: "adicionarPerfil" });
}

function salvarPerfil() {
  return comModal(async () => {
    await adicionarPerfil(selecionadoId.value, { nome: form.nome, username: form.username });
    await recarregar();
    modal.value = null;
  });
}

function abrirLink() {
  abrir({ tipo: "link", validade: 72, url: "", expiraEm: "" });
  gerarLink(72);
}

function gerarLink(horas) {
  modal.value.validade = horas;
  return comModal(async () => {
    const r = await gerarLinkCliente(selecionadoId.value, horas);
    if (modal.value?.tipo === "link") {
      modal.value.url = r.url;
      modal.value.expiraEm = r.expiraEm;
    }
  });
}

const mensagemLink = computed(() => {
  if (modal.value?.tipo !== "link" || !modal.value.url) return "";
  return [
    "Olá! Para publicarmos no seu Instagram, informe o seu perfil (o @) neste link:",
    modal.value.url,
    "",
    `Não pedimos senha. O link vale até ${formatarData(modal.value.expiraEm)} e só pode ser usado uma vez.`,
  ].join("\n");
});

/* ---- campo único: renomear cliente, editar perfil, alterar e-mail ---- */

function abrirCampo({ titulo, subtitulo = "", rotulo, valor, tipoCampo, salvar }) {
  form.valor = valor;
  abrir({ tipo: "campo", titulo, subtitulo, rotulo, tipoCampo, salvar });
}

function salvarCampo() {
  const { salvar } = modal.value;
  return comModal(async () => {
    await salvar(form.valor);
    await recarregar();
    modal.value = null;
  });
}

function abrirRenomear() {
  abrirCampo({
    titulo: "Renomear cliente",
    rotulo: "Nome do cliente",
    valor: detalhe.value.cliente.nome,
    salvar: (nome) => atualizarCliente(selecionadoId.value, { nome }),
  });
}

function abrirEditarPerfil(perfil) {
  abrirCampo({
    titulo: "Editar nome do perfil",
    subtitulo: `@${perfil.username} continua o mesmo; só o nome exibido muda.`,
    rotulo: "Nome do perfil",
    valor: perfil.nome,
    salvar: (nome) => renomearPerfil(perfil.id, nome),
  });
}

function abrirAlterarEmail(usuario) {
  abrirCampo({
    titulo: "Alterar e-mail",
    subtitulo: `${usuario.nome} será desconectado e passa a entrar com o e-mail novo.`,
    rotulo: "Novo e-mail",
    tipoCampo: "email",
    valor: usuario.email,
    salvar: (email) => atualizarUsuario(usuario.id, { email }),
  });
}

/* ---- confirmações ---- */

function confirmar({ titulo, texto, botao, perigo = false, acao }) {
  abrir({ tipo: "confirmar", titulo, texto, botao, perigo, acao });
}

function executarConfirmacao() {
  const { acao } = modal.value;
  return comModal(async () => {
    await acao();
    // Se a ação abriu outro modal (ex.: senha temporária), ele continua aberto.
    if (modal.value?.tipo === "confirmar") modal.value = null;
  });
}

function confirmarCliente(ativo) {
  const nome = detalhe.value.cliente.nome;
  confirmar({
    titulo: ativo ? "Reativar cliente" : "Desativar cliente",
    texto: ativo
      ? `Os usuários ativos de ${nome} voltam a conseguir entrar.`
      : `Todos os usuários de ${nome} perdem o acesso na hora. O histórico de postagens é mantido e o cliente pode ser reativado depois.`,
    botao: ativo ? "Reativar" : "Desativar cliente",
    perigo: !ativo,
    acao: async () => {
      await atualizarCliente(selecionadoId.value, { ativo });
      await recarregar();
    },
  });
}

function confirmarUsuario(usuario, ativo) {
  confirmar({
    titulo: ativo ? "Reativar acesso" : "Desativar acesso",
    texto: ativo
      ? `${usuario.nome} volta a conseguir entrar com a senha que já tinha.`
      : `${usuario.nome} perde o acesso na hora e é desconectado de todos os aparelhos.`,
    botao: ativo ? "Reativar" : "Desativar",
    perigo: !ativo,
    acao: async () => {
      await atualizarUsuario(usuario.id, { ativo });
      await recarregar();
    },
  });
}

function confirmarRedefinir(usuario) {
  confirmar({
    titulo: "Redefinir senha",
    texto: `Uma nova senha temporária será gerada para ${usuario.nome}. A senha atual deixa de funcionar e a pessoa é desconectada.`,
    botao: "Gerar nova senha",
    acao: async () => {
      const r = await redefinirSenha(usuario.id);
      await recarregar();
      mostrarSenha({
        titulo: "Senha redefinida",
        resumo: `Nova senha temporária gerada para ${r.usuario.email}.`,
        usuario: r.usuario,
        senha: r.senhaTemporaria,
      });
    },
  });
}

function confirmarDesconectar(perfil) {
  confirmar({
    titulo: "Desconectar perfil",
    texto: `A sessão salva de @${perfil.username} será apagada. Publicações programadas nesse perfil vão falhar até ele ser conectado de novo.`,
    botao: "Desconectar",
    perigo: true,
    acao: async () => {
      await desconectarInstagram(perfil.id);
      delete conexao.value[perfil.id];
      await recarregar();
    },
  });
}

function confirmarRemoverPerfil(perfil) {
  confirmar({
    titulo: "Remover perfil",
    texto: `@${perfil.username} sai deste cliente de vez, junto com a sessão salva. Se o perfil já tiver publicações, a remoção é recusada para manter o histórico.`,
    botao: "Remover perfil",
    perigo: true,
    acao: async () => {
      await removerPerfil(perfil.id);
      await recarregar();
    },
  });
}

/* ---- excluir cliente ---- */

function abrirExcluir() {
  form.valor = "";
  abrir({
    tipo: "excluir",
    nome: detalhe.value.cliente.nome,
    usuarios: detalhe.value.usuarios.length,
    contas: detalhe.value.contas.length,
  });
}

function executarExclusao() {
  return comModal(async () => {
    await excluirCliente(selecionadoId.value);
    modal.value = null;
    selecionadoId.value = null;
    detalhe.value = null;
    detalheNoCelular.value = false;
    await Promise.all([carregarLista(), alertas.atualizar({ forcar: true })]);
  });
}

/* ========================= conexão do Instagram ========================= */

const conexao = ref({});
const intervalos = new Map();
const EM_ANDAMENTO = ["iniciando", "aguardando_login"];

function emAndamento(contaId) {
  return EM_ANDAMENTO.includes(conexao.value[contaId]?.status);
}

function pararAcompanhamento(id) {
  clearInterval(intervalos.get(id));
  intervalos.delete(id);
}

async function conectar(perfil) {
  try {
    conexao.value[perfil.id] = await conectarInstagram(perfil.id);
  } catch (e) {
    conexao.value[perfil.id] = { status: "erro", mensagem: e.message };
    return;
  }

  pararAcompanhamento(perfil.id);
  intervalos.set(
    perfil.id,
    setInterval(async () => {
      try {
        const estado = await consultarConexao(perfil.id);
        conexao.value[perfil.id] = estado;
        if (!EM_ANDAMENTO.includes(estado.status)) {
          pararAcompanhamento(perfil.id);
          await recarregar();
        }
      } catch (e) {
        conexao.value[perfil.id] = { status: "erro", mensagem: e.message };
        pararAcompanhamento(perfil.id);
      }
    }, 3000)
  );
}

onMounted(carregarLista);
onBeforeUnmount(() => {
  for (const id of [...intervalos.keys()]) pararAcompanhamento(id);
});
</script>

<style scoped>
.cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.colunas {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

/* Bolinhas de situação */
.ponto {
  display: inline-block;
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #c4c4c4;
}

.ponto.ok { background: #2f9e57; }
.ponto.aviso { background: #e2a312; }
.ponto.erro { background: #d0352a; }
.ponto.info { background: #2b6fd6; }
.ponto.cinza { background: #c4c4c4; }

/* Lista */
.lista {
  overflow: hidden;
}

.lista-topo {
  padding: 12px 14px;
  border-bottom: 1px solid #eee;
}

.busca {
  padding: 9px 12px;
}

.item-cliente {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 15px 18px;
  border: 0;
  border-bottom: 1px solid #eee;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.item-cliente:hover {
  background: #fafafa;
}

.item-cliente.selecionado {
  background: #f5f5f5;
  box-shadow: inset 3px 0 0 var(--cor-primaria);
}

.item-cliente.inativo .item-dados {
  opacity: 0.55;
}

.item-dados {
  min-width: 0;
}

.item-dados strong {
  display: block;
  margin-bottom: 3px;
  color: var(--cor-texto);
  font-size: 14.5px;
}

.item-dados small {
  color: #888;
  font-size: 12px;
}

.lista-rodape {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  color: #999;
  font-size: 11.5px;
}

.legenda {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.mostrar-inativos {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  color: #777;
  cursor: pointer;
}

/* Detalhe */
.detalhe {
  min-width: 0;
}

.detalhe-topo {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 22px 24px 0;
}

.detalhe-topo h2 {
  margin: 0 0 4px;
  font-size: 22px;
}

.meta {
  margin: 0;
  color: #888;
  font-size: 13px;
}

.txt-erro {
  color: var(--cor-erro-texto) !important;
}

.txt-info {
  color: #2b4fae !important;
}

.faixa {
  margin: 14px 24px 0;
}

.abas {
  display: flex;
  gap: 26px;
  margin-top: 18px;
  padding: 0 24px;
  border-bottom: 1px solid #eee;
}

.abas button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 0;
  border: 0;
  background: none;
  color: #777;
  font-size: 14px;
  cursor: pointer;
}

.abas button.ativa {
  color: #111;
  font-weight: 700;
  box-shadow: inset 0 -2px 0 var(--cor-primaria);
}

.contagem {
  padding: 1px 7px;
  border-radius: 10px;
  background: #eee;
  color: #555;
  font-size: 12px;
  font-weight: 600;
}

.aba-conteudo {
  padding: 16px 24px 20px;
}

.barra {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 6px;
}

.vazio-aba {
  margin-top: 10px;
  padding: 16px;
  border: 1px dashed #ddd;
  border-radius: 10px;
  color: #888;
  font-size: 13px;
}

.linhas {
  margin: 0;
  padding: 0;
  list-style: none;
}

.linha {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 4px;
  border-bottom: 1px solid #f0f0f0;
}

.linha:last-child {
  border-bottom: 0;
}

.linha.apagada .info {
  opacity: 0.55;
}

.avatar-ig,
.avatar-pessoa {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 800;
}

.avatar-ig {
  background: linear-gradient(135deg, #f58529, #dd2a7b, #8134af);
  color: #fff;
}

.avatar-pessoa {
  background: #f3e8ff;
  color: #6b21a8;
}

.info {
  flex: 1;
  min-width: 0;
}

.info strong {
  display: block;
  font-size: 15px;
}

.info span {
  display: block;
  overflow: hidden;
  color: #888;
  font-size: 12.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.estado {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 7px;
  min-width: 160px;
  color: #444;
  font-size: 13px;
}

.acao-principal {
  display: flex;
  flex: none;
  justify-content: flex-end;
  min-width: 130px;
}

/* Modais */
.arroba {
  position: relative;
}

.arroba > span {
  position: absolute;
  top: 50%;
  left: 12px;
  color: #888;
  font-size: 13px;
  transform: translateY(-50%);
}

.arroba .campo {
  padding-left: 26px;
}

.chips {
  display: flex;
  gap: 8px;
}

.chip {
  padding: 7px 13px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: #fff;
  color: #333;
  font-size: 13px;
  cursor: pointer;
}

.chip.selecionado {
  border-color: var(--cor-primaria);
  background: var(--cor-primaria);
  color: #fff;
}

.caixa-copiar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1.5px dashed #c9c9c9;
  border-radius: 10px;
  background: #fafafa;
}

.caixa-copiar code {
  flex: 1;
  overflow: hidden;
  color: #222;
  font-family: "DejaVu Sans Mono", Consolas, monospace;
  font-size: 12.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.caixa-copiar code.senha {
  font-size: 20px;
  letter-spacing: 1.5px;
}

.carregando-link {
  margin: 0;
  color: #888;
  font-size: 13px;
}

.texto-confirmar {
  margin: 0;
  color: #444;
  font-size: 14px;
  line-height: 1.55;
}

.resumo-exclusao {
  padding: 12px 14px;
  border: 1px solid #f0d0cb;
  border-radius: 10px;
  background: var(--cor-erro-fundo);
  color: #6b1d16;
  font-size: 13px;
  line-height: 1.55;
}

.resumo-exclusao p {
  margin: 0;
}

.resumo-exclusao ul {
  margin: 6px 0 8px;
  padding-left: 18px;
}

.nota-exclusao {
  font-size: 12px;
}

.voltar-lista {
  display: none;
}

@media (max-width: 1100px) {
  .estado {
    min-width: 0;
  }

  .acao-principal {
    min-width: 0;
  }
}

@media (max-width: 960px) {
  .colunas {
    grid-template-columns: 1fr;
  }

  /* Uma coisa por vez: lista OU detalhe. */
  .colunas:not(.mostrar-detalhe) .detalhe,
  .colunas.mostrar-detalhe .lista {
    display: none;
  }

  .voltar-lista {
    display: inline-block;
    margin: 14px 0 0 18px;
    padding: 6px 0;
    border: 0;
    background: none;
    color: #555;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
  }
}

@media (max-width: 600px) {
  .detalhe-topo {
    padding: 14px 16px 0;
  }

  .detalhe-topo h2 {
    font-size: 19px;
  }

  .faixa {
    margin: 12px 16px 0;
  }

  .abas {
    gap: 18px;
    padding: 0 16px;
    overflow-x: auto;
  }

  .abas button {
    flex: none;
    white-space: nowrap;
  }

  .aba-conteudo {
    padding: 12px 16px 16px;
  }

  .barra {
    flex-wrap: wrap;
  }

  .barra .botao {
    flex: 1 1 auto;
  }

  /* Linha do perfil/usuário: dados em cima; situação e ações embaixo. */
  .linha {
    flex-wrap: wrap;
    gap: 8px 12px;
    padding: 14px 0;
  }

  .info {
    flex: 1 1 calc(100% - 56px);
  }

  .info span {
    white-space: normal;
  }

  .estado {
    flex: 1 1 auto;
    padding-left: 54px;
  }

  .acao-principal {
    flex: none;
  }

  .avatar-ig,
  .avatar-pessoa {
    width: 40px;
    height: 40px;
  }

  .item-cliente {
    padding: 14px 16px;
  }

  .lista-rodape {
    padding: 12px 16px;
  }

  .chips {
    flex-wrap: wrap;
  }

  .caixa-copiar {
    flex-wrap: wrap;
  }

  .caixa-copiar code {
    flex-basis: 100%;
    white-space: normal;
    word-break: break-all;
  }
}
</style>
