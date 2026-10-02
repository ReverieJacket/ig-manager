<!--
  Um comentário (ou uma resposta) com perfil, data, texto e curtidas.
  Um comentário principal também mostra, aninhadas abaixo dele, as suas
  respostas (`item.respostas`), em formato compacto.
-->
<template>
  <li class="item" :class="{ 'item--removido': item.removido_em, 'item--resposta': resposta }">
    <div class="avatar" aria-hidden="true">
      {{ item.autor_username.charAt(0).toUpperCase() }}
    </div>

    <div class="corpo">
      <div class="cabecalho-item">
        <strong>@{{ item.autor_username }}</strong>

        <time :datetime="item.publicado_em" :title="formatarData(item.publicado_em)">
          {{ formatarDataRelativa(item.publicado_em) }}
        </time>

        <!-- Indicadores de hierarquia: a resposta diz a quem responde; o pai, quantas tem. -->
        <span v-if="eResposta" class="selo selo--resposta">
          ↳ resposta{{ respondidoA ? ` a @${respondidoA}` : "" }}
        </span>
        <span v-else-if="item.respostas && item.respostas.length" class="selo selo--respostas">
          {{ item.respostas.length }}
          {{ item.respostas.length === 1 ? "resposta" : "respostas" }}
        </span>

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

      <!-- O Instagram não mostra o contador quando são 0; aqui também fica oculto. -->
      <p v-if="item.curtidas > 0" class="metricas">
        ♡ {{ formatarCurtidas(item.curtidas, item.curtidas_aproximado) }}
        {{ item.curtidas === 1 ? "curtida" : "curtidas" }}
      </p>

      <ul v-if="item.respostas && item.respostas.length" class="respostas">
        <ItemComentario
          v-for="r in item.respostas"
          :key="r.id"
          :item="r"
          :resposta-a="item.autor_username"
          resposta
        />
      </ul>
    </div>
  </li>
</template>

<script setup>
import { computed } from "vue";

import {
  formatarCurtidas,
  formatarData,
  formatarDataRelativa,
} from "../../utils/formatadores";

/**
 * @property {object} item - Comentário ou resposta (formato da API de
 *   comentários), com `respostas` quando for um comentário principal.
 * @property {boolean} resposta - `true` para o estilo compacto de resposta.
 * @property {string} respostaA - Autor do comentário pai (informado por quem
 *   aninha). Serve de reserva caso o registro ainda não traga
 *   `resposta_a_username`.
 */
const props = defineProps({
  item: { type: Object, required: true },
  resposta: { type: Boolean, default: false },
  respostaA: { type: String, default: "" },
});

/** É uma resposta: pela coluna do banco, ou porque está aninhada sob um pai. */
const eResposta = computed(() => props.item.eh_resposta === true || props.resposta);

const respondidoA = computed(() => props.item.resposta_a_username || props.respostaA);
</script>

<style scoped>
.item {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #f0f0f0;
}

.item--resposta {
  padding: 10px 0 0;
  border-bottom: none;
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

.item--resposta .avatar {
  width: 26px;
  height: 26px;
  font-size: 11px;
}

.corpo {
  min-width: 0;
  flex: 1;
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

.selo--resposta {
  background: #eaf0fb;
  color: #2a4d8f;
}

.selo--respostas {
  background: #f3eefa;
  color: #5b3a8f;
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

.item--resposta .texto {
  font-size: 13px;
}

.metricas {
  margin: 4px 0 0;
  color: var(--cor-texto-suave);
  font-size: 12px;
}

/* Respostas: recuo e uma linha lateral, como numa conversa. */
.respostas {
  margin: 10px 0 0;
  padding: 0 0 0 14px;
  border-left: 2px solid #eee;
  list-style: none;
}
</style>
