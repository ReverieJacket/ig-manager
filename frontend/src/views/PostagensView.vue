<!--
  Tela "Postagens": resumo por status, filtros, busca e tabela.
  A lógica de dados fica em `usePublicacoes`; aqui só há a composição.
-->
<template>
  <div class="page">
    <div class="page-header header-linha">
      <div>
        <h1>Postagens</h1>
        <p>Acompanhe suas publicações do Instagram.</p>
      </div>

      <router-link to="/criar" class="botao botao--primario create-button">
        <span>+</span>
        Criar
      </router-link>
    </div>

    <ResumoPublicacoes :contagens="contagens" />

    <section class="cartao">
      <div class="posts-toolbar">
        <div class="tabs">
          <button
            v-for="aba in ABAS_FILTRO"
            :key="aba.valor"
            type="button"
            :class="{ selected: filtro === aba.valor }"
            @click="filtro = aba.valor"
          >
            {{ aba.rotulo }}
          </button>
        </div>

        <div class="toolbar-right">
          <input
            v-model="busca"
            class="campo"
            type="text"
            placeholder="Pesquisar..."
          />

          <!-- Placeholder: filtros avançados ainda não implementados. -->
          <button class="botao botao--secundario" type="button">Filtros</button>
        </div>
      </div>

      <div v-if="carregando" class="state">Carregando publicações...</div>

      <div v-else-if="erro" class="state">{{ erro }}</div>

      <div v-else-if="filtradas.length === 0" class="state">
        <strong>Nenhuma publicação encontrada.</strong>
        <span>
          Quando você criar ou agendar uma publicação, ela aparecerá aqui.
        </span>
      </div>

      <TabelaPublicacoes v-else :publicacoes="filtradas" />
    </section>
  </div>
</template>

<script setup>
import ResumoPublicacoes from "../components/publicacoes/ResumoPublicacoes.vue";
import TabelaPublicacoes from "../components/publicacoes/TabelaPublicacoes.vue";
import { ABAS_FILTRO } from "../constants/publicacoes";
import { usePublicacoes } from "../composables/usePublicacoes";

const { carregando, erro, filtro, busca, filtradas, contagens } =
  usePublicacoes();
</script>

<style scoped>
.page {
  width: 100%;
  max-width: 1150px;
  margin: 0 auto;
}

.header-linha {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.create-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 18px;
  text-decoration: none;
}

.create-button span {
  font-size: 19px;
}

.cartao {
  overflow: hidden;
}

.posts-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 70px;
  padding: 0 18px;
  border-bottom: 1px solid #e5e5e5;
}

.tabs {
  display: flex;
  gap: 4px;
}

.tabs button {
  padding: 9px 11px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--cor-texto-suave);
  font-size: 13px;
  cursor: pointer;
}

.tabs button:hover {
  background: #f5f5f5;
}

.tabs button.selected {
  background: #eeeeee;
  color: var(--cor-texto);
  font-weight: 600;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.toolbar-right .campo {
  width: 180px;
  padding: 9px 11px;
  border-radius: 7px;
}

.toolbar-right .botao {
  padding: 9px 13px;
  font-weight: 400;
  font-size: 13px;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 220px;
  color: var(--cor-texto-suave);
  font-size: 14px;
}

.state strong {
  color: #333;
}

@media (max-width: 950px) {
  .posts-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 15px;
  }

  .toolbar-right {
    width: 100%;
  }

  .toolbar-right .campo {
    flex: 1;
  }
}

@media (max-width: 600px) {
  .header-linha {
    flex-direction: column;
    gap: 18px;
  }

  .tabs {
    width: 100%;
    overflow-x: auto;
  }

  .tabs button {
    white-space: nowrap;
  }
}
</style>
