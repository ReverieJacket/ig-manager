<!--
  Janela modal reutilizável: fundo escuro, cabeçalho com título e botão de
  fechar, corpo (slot padrão) e rodapé (slot "rodape").
  Fecha com Esc, com o "×" e clicando fora (exceto se `travada`).
-->
<template>
  <Teleport to="body">
    <div class="modal-fundo" @click.self="fechar">
      <section
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="idTitulo"
        :style="{ width: `min(100%, ${largura}px)` }"
      >
        <header class="modal-cabecalho">
          <div>
            <h2 :id="idTitulo">{{ titulo }}</h2>
            <p v-if="subtitulo">{{ subtitulo }}</p>
          </div>
          <button
            v-if="!travada"
            class="fechar"
            type="button"
            aria-label="Fechar"
            @click="fechar"
          >
            ×
          </button>
        </header>

        <div class="modal-corpo">
          <slot />
        </div>

        <footer v-if="$slots.rodape" class="modal-rodape">
          <slot name="rodape" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, onMounted } from "vue";

const props = defineProps({
  titulo: { type: String, required: true },
  subtitulo: { type: String, default: "" },
  largura: { type: Number, default: 520 },
  /** Impede fechar (ex.: enquanto salva). */
  travada: { type: Boolean, default: false },
});

const emit = defineEmits(["fechar"]);

const idTitulo = `modal-${Math.random().toString(36).slice(2, 9)}`;

function fechar() {
  if (!props.travada) emit("fechar");
}

function aoTeclar(evento) {
  if (evento.key === "Escape") fechar();
}

onMounted(() => document.addEventListener("keydown", aoTeclar));
onBeforeUnmount(() => document.removeEventListener("keydown", aoTeclar));
</script>

<style scoped>
.modal-fundo {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(17, 24, 39, 0.5);
}

.modal {
  max-height: min(90vh, 760px);
  overflow: auto;
  border: 1px solid var(--cor-borda);
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-cabecalho {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 15px;
  padding: 20px 22px;
  border-bottom: 1px solid #eee;
}

.modal-cabecalho h2 {
  margin: 0 0 4px;
  color: var(--cor-titulo);
  font-size: 18px;
}

.modal-cabecalho p {
  margin: 0;
  color: var(--cor-texto-suave);
  font-size: 13px;
  line-height: 1.5;
}

.fechar {
  flex: none;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: #f4f4f4;
  color: #555;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.modal-corpo {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 22px;
}

.modal-rodape {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  border-top: 1px solid #eee;
  background: #fafafa;
}
</style>
