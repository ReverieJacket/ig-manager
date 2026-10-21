<!--
  Seleção de perfis do Instagram na tela "Criar", agrupados por cliente.

  - Busca por cliente, nome ou @.
  - "Todos os perfis conectados" marca/desmarca os que podem ser usados.
  - Perfis sem sessão (aguardando conexão ou sessão expirada) só podem ser
    escolhidos para publicação AGENDADA (`permitirNaoConectados`): até lá o
    administrador consegue conectá-los. Para publicar agora, ficam
    desabilitados com o motivo ao lado.

  v-model: array de ids (string).
-->
<template>
  <div class="seletor" :aria-busy="carregando">
    <div class="topo">
      <input
        v-model.trim="busca"
        class="campo busca"
        type="search"
        placeholder="Buscar cliente ou perfil"
        aria-label="Buscar cliente ou perfil"
        :disabled="desabilitado"
      />
      <label class="todos">
        <input
          type="checkbox"
          :checked="todosMarcados"
          :indeterminate.prop="algunsMarcados"
          :disabled="desabilitado || selecionaveis.length === 0"
          @change="alternarTodos($event.target.checked)"
        />
        {{ permitirNaoConectados ? "Todos os perfis" : "Todos os perfis conectados" }}
        <span class="contagem">{{ selecionaveis.length }}</span>
      </label>
    </div>

    <div v-if="carregando" class="vazio">Carregando perfis...</div>
    <div v-else-if="grupos.length === 0" class="vazio">
      {{ busca ? "Nenhum perfil encontrado." : "Nenhum perfil cadastrado. Adicione perfis em Clientes." }}
    </div>

    <div v-else class="grupos">
      <section v-for="grupo in grupos" :key="grupo.chave" class="grupo">
        <label class="grupo-titulo">
          <input
            type="checkbox"
            :checked="grupoMarcado(grupo)"
            :indeterminate.prop="grupoParcial(grupo)"
            :disabled="desabilitado || grupo.perfis.every((p) => !podeEscolher(p))"
            @change="alternarGrupo(grupo, $event.target.checked)"
          />
          <strong>{{ grupo.nome }}</strong>
          <span>{{ grupo.perfis.length }}</span>
        </label>

        <label
          v-for="perfil in grupo.perfis"
          :key="perfil.id"
          class="opcao"
          :class="{ bloqueada: !podeEscolher(perfil) }"
        >
          <input
            type="checkbox"
            :value="String(perfil.id)"
            :checked="modelValue.includes(String(perfil.id))"
            :disabled="desabilitado || !podeEscolher(perfil)"
            @change="alternar(perfil, $event.target.checked)"
          />
          <span class="nome">{{ perfil.nome }} <small>@{{ perfil.username }}</small></span>
          <span v-if="perfil.status === 'expirada'" class="selo-mini erro">Sessão expirada</span>
          <span v-else-if="perfil.status === 'aguardando'" class="selo-mini aviso">Aguardando conexão</span>
        </label>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";

const props = defineProps({
  modelValue: { type: Array, required: true },
  perfis: { type: Array, required: true },
  carregando: { type: Boolean, default: false },
  desabilitado: { type: Boolean, default: false },
  permitirNaoConectados: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue"]);

const busca = ref("");

function podeEscolher(perfil) {
  return props.permitirNaoConectados || perfil.status === "conectado";
}

const grupos = computed(() => {
  const termo = busca.value.toLowerCase().replace(/^@/, "");
  const mapa = new Map();

  for (const perfil of props.perfis) {
    const nomeCliente = perfil.cliente?.nome || "Sem cliente";
    const casa =
      !termo ||
      nomeCliente.toLowerCase().includes(termo) ||
      String(perfil.nome || "").toLowerCase().includes(termo) ||
      perfil.username.toLowerCase().includes(termo);
    if (!casa) continue;

    const chave = perfil.cliente?.id ?? "sem-cliente";
    if (!mapa.has(chave)) mapa.set(chave, { chave, nome: nomeCliente, perfis: [] });
    mapa.get(chave).perfis.push(perfil);
  }

  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
});

const selecionaveis = computed(() => props.perfis.filter(podeEscolher).map((p) => String(p.id)));

const todosMarcados = computed(
  () => selecionaveis.value.length > 0 && selecionaveis.value.every((id) => props.modelValue.includes(id))
);
const algunsMarcados = computed(() => !todosMarcados.value && props.modelValue.length > 0);

function emitir(ids) {
  emit("update:modelValue", [...new Set(ids)]);
}

function alternar(perfil, marcado) {
  const id = String(perfil.id);
  emitir(marcado ? [...props.modelValue, id] : props.modelValue.filter((x) => x !== id));
}

function idsDoGrupo(grupo) {
  return grupo.perfis.filter(podeEscolher).map((p) => String(p.id));
}

function grupoMarcado(grupo) {
  const ids = idsDoGrupo(grupo);
  return ids.length > 0 && ids.every((id) => props.modelValue.includes(id));
}

function grupoParcial(grupo) {
  return !grupoMarcado(grupo) && idsDoGrupo(grupo).some((id) => props.modelValue.includes(id));
}

function alternarGrupo(grupo, marcado) {
  const ids = idsDoGrupo(grupo);
  emitir(marcado ? [...props.modelValue, ...ids] : props.modelValue.filter((id) => !ids.includes(id)));
}

function alternarTodos(marcado) {
  emitir(marcado ? selecionaveis.value : []);
}

// Ao desligar o agendamento, tira da seleção quem não pode publicar agora.
watch(
  () => props.permitirNaoConectados,
  () => {
    const validos = props.modelValue.filter((id) => selecionaveis.value.includes(id));
    if (validos.length !== props.modelValue.length) emitir(validos);
  }
);
</script>

<style scoped>
.seletor {
  border: 1px solid var(--cor-borda, #ddd);
  border-radius: 8px;
}

.topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
}

.busca {
  flex: 1;
  min-width: 180px;
  padding: 8px 11px;
}

.todos {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.contagem,
.grupo-titulo span {
  padding: 0 7px;
  border-radius: 10px;
  background: #eee;
  color: #555;
  font-size: 11.5px;
  font-weight: 600;
}

.grupos {
  max-height: 320px;
  overflow-y: auto;
}

.grupo {
  padding: 8px 12px 10px;
  border-bottom: 1px solid #f2f2f2;
}

.grupo:last-child {
  border-bottom: 0;
}

.grupo-titulo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0 6px;
  font-size: 13px;
  cursor: pointer;
}

.opcao {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 0 5px 24px;
  font-size: 13px;
  cursor: pointer;
}

.opcao.bloqueada {
  color: #999;
  cursor: default;
}

.opcao small {
  color: #888;
}

.nome {
  min-width: 0;
}

.selo-mini {
  margin-left: auto;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  white-space: nowrap;
}

.selo-mini.erro {
  background: var(--cor-erro-fundo);
  color: var(--cor-erro-texto);
}

.selo-mini.aviso {
  background: #fff6e0;
  color: #7a5200;
}

input[type="checkbox"] {
  accent-color: var(--cor-primaria);
}

.vazio {
  padding: 14px 12px;
  color: #888;
  font-size: 13px;
}
</style>
