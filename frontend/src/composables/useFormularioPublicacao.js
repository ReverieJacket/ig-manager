/**
 * Composable do formulário "Nova publicação": estado dos campos,
 * validação, escolha de imagem e envio (imediato ou agendado).
 */
import { computed, onUnmounted, ref } from "vue";

import { criarPublicacao } from "../api/publicacoes";
import { IMAGEM } from "../constants/publicacoes";
import { dataDeHoje } from "../utils/formatadores";

/**
 * @returns Estado e ações do formulário. Principais itens:
 *   - campos: `contaId`, `texto`, `agendar`, `data`, `hora`, `arquivo`, `previa`;
 *   - estado: `formularioValido`, `enviando`, `mensagem`, `sucesso`, `incerto`;
 *   - ações: `escolherArquivo(arquivo)`, `enviar({ agendado })`.
 */
export function useFormularioPublicacao() {
  const contaId = ref("");
  const texto = ref("");
  const agendar = ref(false);
  const data = ref("");
  const hora = ref("");

  const arquivo = ref(null);
  /** URL temporária (blob:) usada só para pré-visualizar a imagem. */
  const previa = ref("");

  const enviando = ref(false);
  const mensagem = ref("");
  const sucesso = ref(false);
  /**
   * `true` quando o Instagram não confirmou a publicação: ela PODE ter
   * sido feita, então o usuário deve conferir o perfil antes de repetir.
   */
  const incerto = ref(false);

  const dataMinima = computed(dataDeHoje);

  const formularioValido = computed(() => {
    if (!contaId.value || !arquivo.value || !texto.value.trim()) {
      return false;
    }

    return agendar.value ? Boolean(data.value && hora.value) : true;
  });

  function definirMensagem(conteudo, ehSucesso, ehIncerto = false) {
    mensagem.value = conteudo;
    sucesso.value = ehSucesso;
    incerto.value = ehIncerto;
  }

  function liberarPrevia() {
    if (previa.value) URL.revokeObjectURL(previa.value);
    previa.value = "";
  }

  /**
   * Valida o arquivo escolhido e gera a pré-visualização.
   *
   * @param {File} arquivoEscolhido
   * @returns {boolean} `false` se o arquivo foi recusado (a mensagem de
   *   erro já foi definida).
   */
  function escolherArquivo(arquivoEscolhido) {
    if (!IMAGEM.tiposPermitidos.includes(arquivoEscolhido.type)) {
      definirMensagem("Selecione uma imagem JPG, PNG ou WEBP.", false);
      return false;
    }

    if (arquivoEscolhido.size > IMAGEM.tamanhoMaximoMb * 1024 * 1024) {
      definirMensagem(
        `A imagem deve ter no máximo ${IMAGEM.tamanhoMaximoMb} MB.`,
        false
      );
      return false;
    }

    liberarPrevia();
    arquivo.value = arquivoEscolhido;
    previa.value = URL.createObjectURL(arquivoEscolhido);
    definirMensagem("", false);

    return true;
  }

  /**
   * Monta o instante de agendamento em ISO 8601 com fuso explícito.
   *
   * @returns {string}
   * @throws {Error} Se data/hora estiverem ausentes, inválidas ou no passado.
   */
  function montarDataHoraAgendada() {
    if (!data.value || !hora.value) {
      throw new Error("Informe a data e o horário da publicação.");
    }

    // O navegador interpreta este valor no fuso horário local.
    const instante = new Date(`${data.value}T${hora.value}:00`);

    if (Number.isNaN(instante.getTime())) {
      throw new Error("Data ou horário inválidos.");
    }

    if (instante.getTime() <= Date.now()) {
      throw new Error("Selecione uma data e horário futuros.");
    }

    return instante.toISOString();
  }

  function limpar() {
    liberarPrevia();
    arquivo.value = null;
    texto.value = "";
    agendar.value = false;
    data.value = "";
    hora.value = "";
  }

  /**
   * Envia a publicação e limpa o formulário em caso de sucesso.
   *
   * @param {{agendado: boolean}} opcoes - `true` usa a data/hora escolhidas;
   *   `false` publica imediatamente.
   */
  async function enviar({ agendado }) {
    if (!formularioValido.value) {
      definirMensagem(
        agendado
          ? "Selecione uma conta, uma imagem, informe a legenda, a data e o horário."
          : "Selecione uma conta, uma imagem e informe a legenda.",
        false
      );
      return;
    }

    enviando.value = true;
    definirMensagem("", false);

    try {
      const resultado = await criarPublicacao({
        imagem: arquivo.value,
        texto: texto.value.trim(),
        dataHora: agendado
          ? montarDataHoraAgendada()
          : new Date().toISOString(),
        contaId: contaId.value,
      });

      definirMensagem(
        resultado.mensagem ||
          (agendado
            ? "Publicação agendada com sucesso."
            : "Publicação processada com sucesso."),
        true
      );
      limpar();
    } catch (erro) {
      console.error("Erro ao enviar publicação:", erro);
      definirMensagem(
        erro.message || "Não foi possível processar a publicação.",
        false,
        Boolean(erro.dados?.resultadoIncerto)
      );
    } finally {
      enviando.value = false;
    }
  }

  onUnmounted(liberarPrevia);

  return {
    contaId,
    texto,
    agendar,
    data,
    hora,
    arquivo,
    previa,
    dataMinima,
    formularioValido,
    enviando,
    mensagem,
    sucesso,
    incerto,
    escolherArquivo,
    enviar,
  };
}
