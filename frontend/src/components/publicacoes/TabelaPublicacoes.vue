<!--
  Tabela de publicações. Componente de apresentação: recebe a lista
  pronta e não faz requisições.
-->
<template>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Imagem</th>
          <th>Legenda</th>
          <th>Conta</th>
          <th>Status</th>
          <th>Data/Hora</th>
          <th>Engajamento</th>
          <th>Cliente</th>
          <th>Ações</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="post in publicacoes" :key="post.id">
          <td>
            <div class="image-placeholder">
              <img v-if="post.imagem" :src="post.imagem" alt="" />
              <span v-else>—</span>
            </div>
          </td>

          <td class="caption">{{ post.texto || "Sem legenda" }}</td>

          <td>{{ post.conta || post.username || "—" }}</td>

          <td>
            <span class="status" :class="normalizarStatus(post.status)">
              {{ formatarStatus(post.status) }}
            </span>
          </td>

          <td>{{ formatarData(post.data_hora) }}</td>

          <!-- Curtidas ainda não são fornecidas pelo backend (exibem 0). -->
          <td>
            <div class="engagement">
              <span>♡ {{ post.curtidas ?? 0 }}</span>

              <button
                type="button"
                class="comentarios"
                :disabled="normalizarStatus(post.status) !== STATUS.PUBLICADA"
                :aria-label="`Ver comentários (${post.comentarios_total ?? 0})`"
                :title="
                  normalizarStatus(post.status) === STATUS.PUBLICADA
                    ? 'Ver comentários'
                    : 'Disponível após a publicação'
                "
                @click="emit('comentarios', post)"
              >
                ◌ {{ post.comentarios_total ?? 0 }}
              </button>
            </div>
          </td>

          <td>{{ post.cliente || "—" }}</td>

          <td>
            <button class="action-button" type="button">⋮</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { STATUS } from "../../constants/publicacoes";
import {
  formatarData,
  formatarStatus,
  normalizarStatus,
} from "../../utils/formatadores";

/**
 * @property {Array<object>} publicacoes - Publicações já filtradas, no
 *   formato devolvido por `api/publicacoes.js`.
 * @event comentarios - O usuário clicou no ícone de comentários; envia a
 *   publicação da linha.
 */
defineProps({
  publicacoes: { type: Array, required: true },
});

const emit = defineEmits(["comentarios"]);
</script>

<style scoped>
.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
}

th {
  padding: 13px 15px;
  background: var(--cor-fundo);
  border-bottom: 1px solid #e5e5e5;
  color: var(--cor-texto-suave);
  font-size: 11px;
  font-weight: 600;
  text-align: left;
}

td {
  padding: 14px 15px;
  border-bottom: 1px solid #eeeeee;
  color: #333;
  font-size: 13px;
}

tr:last-child td {
  border-bottom: none;
}

.image-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  overflow: hidden;
  border-radius: 6px;
  background: #f2f2f2;
}

.image-placeholder img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.caption {
  max-width: 220px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.status {
  display: inline-flex;
  padding: 5px 8px;
  border-radius: 6px;
  background: #eeeeee;
  color: #444;
  font-size: 11px;
  font-weight: 600;
}

.status.erro {
  background: var(--cor-erro-fundo);
  color: var(--cor-erro-texto);
}

.status.publicada {
  background: var(--cor-sucesso-fundo);
  color: var(--cor-sucesso-texto);
}

.engagement {
  display: flex;
  gap: 9px;
  color: #666;
  font-size: 12px;
}

.comentarios {
  padding: 2px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}

.comentarios:hover:not(:disabled) {
  background: #eeeeee;
  color: var(--cor-texto);
}

.comentarios:disabled {
  cursor: default;
}

.action-button {
  border: none;
  background: transparent;
  color: #666;
  font-size: 18px;
  cursor: pointer;
}
</style>
