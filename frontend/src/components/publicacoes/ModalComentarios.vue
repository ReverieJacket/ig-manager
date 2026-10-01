<!--
  Modal com os comentários de uma publicação.
  Usa o elemento nativo <dialog>: já oferece fechar com Esc, bloqueio do
  fundo e devolução do foco ao botão que o abriu.
-->
<template>
  <dialog
    ref="dialogo"
    class="modal"
    aria-labelledby="comentarios-titulo"
    @close="emit('fechar')"
    @click.self="dialogo.close()"
  >
    <div v-if="publicacao" class="conteudo">
      <header class="topo">
        <div class="titulos">
          <h2 id="comentarios-titulo">Comentários</h2>
          <p class="legenda" :title="publicacao.texto">
            {{ publicacao.texto || "Sem legenda" }}
          </p>
        </div>

        <button
          type="button"
          class="fechar"
          aria-label="Fechar"
          @click="dialogo.close()"
        >
          ×
        </button>
      </header>

      <div class="barra">
        <div class="contagem">
          <strong>{{ total }}</strong>
          {{ total === 1 ? "comentário" : "comentários" }}
          <span class="atualizado">
            ·
            <template v-if="atualizadoEm" >
              atualizado {{ formatarDataRelativa(atualizadoEm) }}
            </template>
            <template v-else>ainda não coletado</template>
          </span>
        </div>

        <div class="acoes">
          <label class="filtro">
            <input v-model="incluirRemovidos" type="checkbox" />
            Mostrar removidos
          </label>

          <button
            type="button"
            class="botao botao--secundario atualizar"
            :disabled="coletando"
            @click="coletar"
          >
            {{ coletando ? "Coletando…" : "↻ Atualizar agora" }}
          </button>
        </div>
      </div>

      <p v-if="coletando" class="aviso-coleta" role="status">
        Um navegador será aberto para ler os comentários no Instagram. Pode
        levar alguns minutos; não feche a janela dele.
      </p>

      <p
        v-if="resumoColeta"
        class="resumo"
        :class="`resumo--${resumoColeta.tipo}`"
        role="status"
      >
        {{ resumoColeta.texto }}
      </p>

      <div class="lista-area">
        <p v-if="erro" class="estado estado--erro" role="alert">{{ erro }}</p>

        <p v-else-if="carregando && !itens.length" class="estado" role="status">
          Carregando comentários…
        </p>

        <p v-else-if="!itens.length" class="estado">
          <strong>Nenhum comentário guardado.</strong>
          <span>
            Use “Atualizar agora” para buscar os comentários no Instagram.
          </span>
        </p>

        <ul v-else class="lista">
          <li
            v-for="item in itens"
            :key="item.id"
            class="item"
            :class="{ 'item--removido': item.removido_em }"
          >
            <div class="avatar" aria-hidden="true">
              {{ item.autor_username.charAt(0).toUpperCase() }}
            </div>

            <div class="corpo">
              <div class="cabecalho-item">
                <strong>@{{ item.autor_username }}</strong>

                <time
                  :datetime="item.publicado_em"
                  :title="formatarData(item.publicado_em)"
                >
                  {{ formatarDataRelativa(item.publicado_em) }}
                </time>

                <span v-if="item.oculto" class="selo">oculto pelo Instagram</span>
                <span
                  v-if="item.removido_em"
                  class="selo selo--removido"
                  :title="`Deixou de aparecer em ${formatarData(item.removido_em)}`"
                >
                  removido
                </span>
              </div>

              <p class="texto">{{ item.texto }}</p>
            </div>
          </li>
        </ul>

        <button
          v-if="itens.length && temMais"
          type="button"
          class="botao botao--secundario mais"
          :disabled="carregando"
          @click="carregarMais"
        >
          {{ carregando ? "Carregando…" : "Carregar mais" }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";

import { useComentarios } from "../../composables/useComentarios";
import { formatarData, formatarDataRelativa } from "../../utils/formatadores";

/**
 * @property {object|null} publicacao - Publicação a exibir; `null` mantém o
 *   modal fechado. Precisa de `id` e (opcional) `texto`.
 * @event fechar - O modal foi fechado (Esc, botão ou clique fora).
 * @event atualizado - Uma coleta terminou; quem usa pode recarregar a lista
 *   de publicações para atualizar o contador.
 */
const props = defineProps({
  publicacao: { type: Object, default: null },
});

const emit = defineEmits(["fechar", "atualizado"]);

const dialogo = ref(null);

const publicacaoId = computed(() => props.publicacao?.id ?? null);

const {
  itens,
  total,
  atualizadoEm,
  carregando,
  erro,
  temMais,
  incluirRemovidos,
  coletando,
  resumoColeta,
  carregarMais,
  coletar,
} = useComentarios(publicacaoId);

// Abre/fecha o <dialog> conforme a publicação informada.
watch(
  () => props.publicacao,
  async (nova) => {
    await nextTick();

    if (nova && !dialogo.value.open) dialogo.value.showModal();
    else if (!nova && dialogo.value.open) dialogo.value.close();
  }
);

// Após uma coleta bem-sucedida, avisa para atualizar o contador na tabela.
watch(resumoColeta, (resumo) => {
  if (resumo && resumo.tipo !== "erro") emit("atualizado");
});
</script>

<style scoped>
.modal {
  width: min(680px, calc(100vw - 32px));
  max-height: min(720px, calc(100vh - 48px));
  padding: 0;
  overflow: hidden;
  border: none;
  border-radius: 14px;
  background: var(--cor-superficie);
  color: var(--cor-texto);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
}

.modal::backdrop {
  background: rgba(20, 20, 20, 0.45);
}

.conteudo {
  display: flex;
  flex-direction: column;
  max-height: inherit;
}

.topo {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 14px;
  border-bottom: 1px solid #eee;
}

.titulos {
  min-width: 0;
}

.titulos h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.legenda {
  margin: 0;
  overflow: hidden;
  color: var(--cor-texto-suave);
  font-size: 13px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.fechar {
  flex: none;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #666;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.fechar:hover {
  background: #f2f2f2;
}

.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  padding: 12px 22px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

.atualizado {
  color: var(--cor-texto-suave);
}

.acoes {
  display: flex;
  align-items: center;
  gap: 14px;
}

.filtro {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #555;
  cursor: pointer;
}

.atualizar {
  padding: 8px 12px;
  font-size: 13px;
}

.aviso-coleta,
.resumo {
  margin: 0;
  padding: 10px 22px;
  font-size: 12px;
}

.aviso-coleta {
  background: #f6f6f6;
  color: #555;
}

.resumo--sucesso {
  background: var(--cor-sucesso-fundo);
  color: var(--cor-sucesso-texto);
}

.resumo--aviso {
  background: #fff6e0;
  color: #7a5200;
}

.resumo--erro {
  background: var(--cor-erro-fundo);
  color: var(--cor-erro-texto);
}

.lista-area {
  flex: 1;
  min-height: 160px;
  padding: 6px 22px 20px;
  overflow-y: auto;
}

.lista {
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
}

.item--removido {
  opacity: 0.6;
}

.avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f58529, #dd2a7b, #8134af);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}

.corpo {
  min-width: 0;
}

.cabecalho-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  font-size: 13px;
}

.cabecalho-item time {
  color: var(--cor-texto-suave);
  font-size: 12px;
}

.selo {
  padding: 2px 6px;
  border-radius: 5px;
  background: #eee;
  color: #555;
  font-size: 11px;
}

.selo--removido {
  background: var(--cor-erro-fundo);
  color: var(--cor-erro-texto);
}

.texto {
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.estado {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 160px;
  margin: 0;
  color: var(--cor-texto-suave);
  font-size: 14px;
  text-align: center;
}

.estado--erro {
  color: var(--cor-erro-texto);
}

.mais {
  display: block;
  margin: 14px auto 0;
}

@media (max-width: 520px) {
  .barra,
  .acoes {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
