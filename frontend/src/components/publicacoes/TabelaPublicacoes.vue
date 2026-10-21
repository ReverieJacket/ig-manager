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
          <th>Perfil</th>
          <th>Status</th>
          <th>Aprovação do cliente</th>
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
            <small
              v-if="normalizarStatus(post.status) === STATUS.ERRO && post.erro"
              class="motivo-erro"
              :title="post.erro"
            >{{ post.erro }}</small>
          </td>

          <td class="aprovacao">
            <template v-if="normalizarStatus(post.status) === STATUS.CANCELADA">
              <span class="status cancelada">Cancelada</span>
              <small>pela equipe{{ post.cancelada_por_nome ? ` (${post.cancelada_por_nome})` : "" }}{{ post.cancelada_em ? ` · ${formatarData(post.cancelada_em)}` : "" }}</small>
            </template>
            <template v-else-if="post.aprovacao">
              <span class="status" :class="aprovacaoDe(post).classe">{{ aprovacaoDe(post).rotulo }}</span>
              <small :class="{ 'motivo-erro': post.aprovacao === APROVACAO.INDEFERIDA }" :title="aprovacaoDe(post).detalhe">
                {{ aprovacaoDe(post).detalhe }}
              </small>
            </template>
            <template v-else>
              <span class="status">Não requer</span>
              <small>publicada na hora</small>
            </template>
          </td>

          <td>{{ formatarData(post.data_hora) }}</td>

          <td>
            <div class="engagement">
              <span
                :title="
                  post.curtidas_atualizado_em
                    ? `Curtidas lidas em ${formatarData(post.curtidas_atualizado_em)}`
                    : 'Ainda não coletado'
                "
              >
                ♡ {{ formatarCurtidas(post.curtidas, post.curtidas_aproximado) }}
              </span>

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
            <MenuAcoes
              v-if="podeResponder(post) || podeCancelar(post)"
              :itens="acoesDe(post)"
              rotulo="Ações da publicação"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import MenuAcoes from "../comum/MenuAcoes.vue";
import { APROVACAO, STATUS } from "../../constants/publicacoes";
import {
  formatarCurtidas,
  formatarData,
  formatarStatus,
  normalizarStatus,
} from "../../utils/formatadores";

/**
 * @property {Array<object>} publicacoes - Publicações já filtradas, no
 *   formato devolvido por `api/publicacoes.js`.
 * @event comentarios - O usuário clicou no ícone de comentários; envia a
 *   publicação da linha.
 * @event aprovacao - "Deferir/Indeferir pelo cliente": `{ publicacao, decisao }`.
 * @event cancelar - "Cancelar publicação": envia a publicação.
 */
defineProps({
  publicacoes: { type: Array, required: true },
});

const emit = defineEmits(["comentarios", "aprovacao", "cancelar"]);

/** Agendada ou recusada (ainda não saiu): o administrador pode cancelar. */
function podeCancelar(post) {
  return [STATUS.AGENDADA, STATUS.RECUSADA].includes(normalizarStatus(post.status));
}

function acoesDe(post) {
  const itens = podeResponder(post) ? acoesAprovacao(post) : [];
  if (podeCancelar(post)) {
    itens.push({
      rotulo: "⊘ Cancelar publicação",
      acao: () => emit("cancelar", post),
      perigo: true,
      separadorAntes: itens.length > 0,
    });
  }
  return itens;
}

/** Agendada/recusada com aprovação e horário no futuro: dá para responder. */
function podeResponder(post) {
  const status = normalizarStatus(post.status);
  return (
    Boolean(post.aprovacao) &&
    [STATUS.AGENDADA, STATUS.RECUSADA].includes(status) &&
    new Date(post.data_hora).getTime() > Date.now()
  );
}

function acoesAprovacao(post) {
  return [
    { titulo: "Resposta pelo cliente" },
    {
      rotulo: "✓ Deferir pelo cliente",
      acao: () => emit("aprovacao", { publicacao: post, decisao: APROVACAO.DEFERIDA }),
      desabilitado: post.aprovacao === APROVACAO.DEFERIDA,
    },
    {
      rotulo: "✕ Indeferir pelo cliente",
      acao: () => emit("aprovacao", { publicacao: post, decisao: APROVACAO.INDEFERIDA }),
      desabilitado: post.aprovacao === APROVACAO.INDEFERIDA,
      perigo: true,
    },
  ];
}

/** Selo e detalhe da coluna "Aprovação do cliente". */
function aprovacaoDe(post) {
  const quem = post.aprovacao_pela_equipe
    ? `pela equipe${post.aprovacao_por_nome ? ` (${post.aprovacao_por_nome})` : ""}`
    : `por ${post.aprovacao_por_nome || "cliente"}`;
  const quando = post.aprovacao_em ? ` · ${formatarData(post.aprovacao_em)}` : "";

  if (post.aprovacao === APROVACAO.DEFERIDA) {
    return { rotulo: "✓ Deferida", classe: "publicada", detalhe: `${quem}${quando}` };
  }
  if (post.aprovacao === APROVACAO.INDEFERIDA) {
    const motivo = post.aprovacao_motivo ? `: “${post.aprovacao_motivo}”` : "";
    return { rotulo: "✕ Indeferida", classe: "erro", detalhe: `${quem}${motivo}` };
  }
  // Pendente
  const status = normalizarStatus(post.status);
  if (status === STATUS.AGENDADA) {
    return { rotulo: "● Aguardando", classe: "pendente", detalhe: `Sem resposta até ${formatarData(post.data_hora)} → publica` };
  }
  return { rotulo: "Sem resposta", classe: "", detalhe: status === STATUS.PUBLICADA ? "publicada no horário" : "" };
}
</script>

<style scoped>
.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 1080px;
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

.motivo-erro {
  display: -webkit-box;
  max-width: 190px;
  margin-top: 5px;
  overflow: hidden;
  color: var(--cor-erro-texto);
  font-size: 11.5px;
  line-height: 1.35;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.aprovacao small {
  display: block;
  max-width: 220px;
  margin-top: 5px;
  color: #888;
  font-size: 11.5px;
  line-height: 1.35;
}

.aprovacao small.motivo-erro {
  display: -webkit-box;
  color: var(--cor-erro-texto);
}

.status.pendente {
  background: #fff6e0;
  color: #8a5a00;
}

.status.agendada {
  background: #eef3ff;
  color: #2b4fae;
}

.status.cancelada {
  background: #efefef;
  color: #666;
  text-decoration: line-through;
}

.status.recusada {
  background: var(--cor-erro-fundo);
  color: var(--cor-erro-texto);
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

</style>
