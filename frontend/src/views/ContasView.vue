<template>
  <div class="page contas-page">
    <header class="page-header contas-header">
      <div>
        <h1>Contas do Instagram</h1>
        <p>Gerencie as contas vinculadas aos seus clientes.</p>
      </div>
      <button class="botao botao--secundario" type="button" :disabled="carregando" @click="carregar">
        <span aria-hidden="true">↻</span> Atualizar
      </button>
    </header>

    <section class="acoes-cadastro" aria-label="Opções de cadastro">
      <button class="acao-card" type="button" @click="abrirModal('link')">
        <span class="acao-icone acao-icone--link" aria-hidden="true">↗</span>
        <span class="acao-conteudo">
          <strong>Gerar link de cadastro</strong>
          <small>Compartilhe um formulário exclusivo com o cliente pelo WhatsApp ou e-mail.</small>
          <span class="acao-link">Gerar link <span aria-hidden="true">→</span></span>
        </span>
      </button>

      <button class="acao-card" type="button" @click="abrirModal('manual')">
        <span class="acao-icone acao-icone--manual" aria-hidden="true">＋</span>
        <span class="acao-conteudo">
          <strong>Cadastrar manualmente</strong>
          <small>Adicione os dados da conta diretamente no sistema.</small>
          <span class="acao-link">Novo cadastro <span aria-hidden="true">→</span></span>
        </span>
      </button>
    </section>

    <section class="cartao resumo-contas">
      <div class="resumo-label">Contas ativas</div>
      <strong class="resumo-numero">{{ contas.length }}</strong>
      <small>Disponíveis para publicações</small>
    </section>

    <section class="cartao lista-card">
      <div class="lista-cabecalho">
        <div class="lista-titulo">
          <h2>Contas cadastradas</h2>
          <span class="contador">{{ filtradas.length }}</span>
        </div>
        <label class="pesquisa">
          <span aria-hidden="true">⌕</span>
          <input v-model="busca" class="campo" type="search" placeholder="Pesquisar por nome ou usuário..." aria-label="Pesquisar contas" />
        </label>
      </div>

      <div v-if="carregando && !contas.length" class="estado" role="status">Carregando contas...</div>
      <div v-else-if="erro" class="estado estado--erro" role="alert">
        <strong>Não foi possível carregar as contas</strong>
        <span>{{ erro }}</span>
        <button class="botao botao--secundario" type="button" @click="carregar">Tentar novamente</button>
      </div>
      <div v-else-if="!contas.length" class="estado">
        <span class="estado-icone" aria-hidden="true">◎</span>
        <strong>Nenhuma conta cadastrada</strong>
        <span>Cadastre uma conta manualmente ou gere um link para o cliente.</span>
      </div>
      <div v-else-if="!filtradas.length" class="estado">
        <strong>Nenhuma conta encontrada</strong>
        <span>Altere os termos da pesquisa e tente novamente.</span>
        <button class="botao-texto" type="button" @click="busca = ''">Limpar pesquisa</button>
      </div>
      <div v-else class="contas-lista">
        <article v-for="conta in filtradas" :key="conta.id" class="conta-linha">
          <div class="avatar-conta" aria-hidden="true">{{ iniciais(conta.nome || conta.username) }}</div>
          <div class="conta-dados">
            <strong>{{ conta.nome || 'Conta do Instagram' }}</strong>
            <span>@{{ (conta.username || '').replace(/^@/, '') || 'usuário não informado' }}</span>
          </div>
          <div class="conta-conexao">
            <span class="status-conta" :class="{
              'status-conta--conectada': conexoes[conta.id]?.status === 'conectado',
              'status-conta--pendente': conexoes[conta.id]?.status !== 'conectado'
            }"><i></i>{{ conexoes[conta.id]?.status === 'conectado' ? 'Conectada' : (conexoes[conta.id]?.status === 'aguardando_login' ? 'Aguardando login' : 'Não conectada') }}</span>
            <button class="botao botao--secundario" type="button"
              :disabled="conectando[conta.id] || ['iniciando','aguardando_login'].includes(conexoes[conta.id]?.status)"
              @click="iniciarConexao(conta)">
              {{ conectando[conta.id] ? 'Iniciando...' : 'Conectar Instagram' }}
            </button>
            <button v-if="conexoes[conta.id]?.status === 'conectado'" class="botao-texto" type="button" @click="desconectarConta(conta)">Desconectar</button>
            <small v-if="conexoes[conta.id]?.mensagem">{{ conexoes[conta.id].mensagem }}</small>
          </div>
        </article>
      </div>
      <footer v-if="!carregando && !erro && contas.length" class="lista-rodape">
        Exibindo {{ filtradas.length }} de {{ contas.length }} contas ativas
      </footer>
    </section>

    <div v-if="modalAberto" class="modal-fundo" @click.self="fecharModal" @keydown.esc="fecharModal">
      <section class="modal" role="dialog" aria-modal="true" :aria-labelledby="'modal-titulo'">
        <header class="modal-cabecalho">
          <div>
            <h2 id="modal-titulo">{{ modalTipo === 'link' ? 'Gerar link de cadastro' : 'Cadastrar conta manualmente' }}</h2>
            <p>{{ modalTipo === 'link' ? 'Defina o cliente e as condições do convite.' : 'Informe os dados da conta do Instagram.' }}</p>
          </div>
          <button class="fechar-modal" type="button" aria-label="Fechar" @click="fecharModal">×</button>
        </header>

        <form class="modal-form" @submit.prevent="enviarFormulario">
          <div class="campo-grupo">
            <label for="cliente">Cliente <span>*</span></label>
            <input id="cliente" v-model.trim="form.cliente" class="campo" type="text" required maxlength="120" placeholder="Nome do cliente" />
            <small>O vínculo definitivo será validado pelo backend na implementação da API.</small>
          </div>

          <template v-if="modalTipo === 'manual'">
            <div class="campo-grupo">
              <label for="nome-conta">Nome da conta <span>*</span></label>
              <input id="nome-conta" v-model.trim="form.nome" class="campo" type="text" required maxlength="120" placeholder="Ex.: Loja Exemplo" />
            </div>
            <div class="campo-grupo">
              <label for="username">Nome de usuário do Instagram <span>*</span></label>
              <div class="username-input"><span>@</span><input id="username" v-model.trim="form.username" class="campo" type="text" required maxlength="30" placeholder="usuario" /></div>
            </div>
          </template>
          <template v-else>
            <div class="campo-grupo">
              <label for="validade">Validade do link</label>
              <select id="validade" v-model="form.validade" class="campo">
                <option value="24">24 horas</option>
                <option value="72">3 dias</option>
                <option value="168">7 dias</option>
              </select>
            </div>
            <div class="aviso-seguranca">
              O link será exclusivo e deverá expirar automaticamente. O cliente não precisará informar a senha do Instagram.
            </div>
          </template>

          <p v-if="mensagem" class="mensagem-form" role="status">{{ mensagem }}</p>
          <footer class="modal-acoes">
            <button class="botao botao--secundario" type="button" @click="fecharModal">Cancelar</button>
            <button class="botao botao--primario" type="submit" :disabled="enviando">{{ enviando ? "Salvando..." : (modalTipo === 'link' ? 'Gerar link' : 'Cadastrar conta') }}</button>
          </footer>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, onBeforeUnmount } from 'vue';
import { useContas } from '../composables/useContas';
import { cadastrarConta, conectarInstagram, consultarConexao, desconectarInstagram } from '../api/contas';

const { contas, carregando, erro, carregar } = useContas();
const busca = ref('');
const modalAberto = ref(false);
const modalTipo = ref('manual');
const mensagem = ref('');
const enviando = ref(false);
const form = reactive({ cliente: '', nome: '', username: '', validade: '24' });
const conexoes = ref({});
const conectando = ref({});
const intervalos = new Map();

async function iniciarConexao(conta) {
  conectando.value[conta.id] = true;
  try {
    conexoes.value[conta.id] = await conectarInstagram(conta.id);
    acompanharConexao(conta.id);
  } catch (e) {
    conexoes.value[conta.id] = { status: 'erro', mensagem: e.message || 'Falha ao iniciar conexao.' };
  } finally { conectando.value[conta.id] = false; }
}
function pararAcompanhamento(id) {
  if (intervalos.has(id)) { clearInterval(intervalos.get(id)); intervalos.delete(id); }
}
function acompanharConexao(id) {
  pararAcompanhamento(id);
  const consultar = async () => {
    try {
      const estado = await consultarConexao(id);
      conexoes.value[id] = estado;
      if (['conectado','erro','cancelado','desconectado'].includes(estado.status)) pararAcompanhamento(id);
    } catch(e) {
      conexoes.value[id] = {status:'erro', mensagem:e.message || 'Falha ao consultar conexao.'};
      pararAcompanhamento(id);
    }
  };
  consultar();
  intervalos.set(id, setInterval(consultar, 3000));
}
async function desconectarConta(conta) {
  try { conexoes.value[conta.id] = await desconectarInstagram(conta.id); pararAcompanhamento(conta.id); }
  catch(e) { conexoes.value[conta.id] = {status:'erro',mensagem:e.message || 'Falha ao desconectar.'}; }
}
onBeforeUnmount(() => { for (const id of [...intervalos.keys()]) pararAcompanhamento(id); });


const filtradas = computed(() => {
  const termo = busca.value.trim().toLowerCase();
  if (!termo) return contas.value;
  return contas.value.filter((conta) =>
    [conta.nome, conta.username].some((valor) => String(valor || '').toLowerCase().includes(termo))
  );
});

function abrirModal(tipo) {
  modalTipo.value = tipo;
  mensagem.value = '';
  Object.assign(form, { cliente: '', nome: '', username: '', validade: '24' });
  modalAberto.value = true;
}

function fecharModal() {
  modalAberto.value = false;
  mensagem.value = '';
}

async function enviarFormulario() {
  mensagem.value = '';

  if (modalTipo.value === 'link') {
    mensagem.value = 'A geração de links será implementada em uma etapa própria. Por enquanto, utilize o cadastro manual.';
    return;
  }

  enviando.value = true;
  try {
    await cadastrarConta({
      cliente: form.cliente,
      nome: form.nome,
      username: form.username,
    });
    await carregar();
    fecharModal();
  } catch (erroApi) {
    mensagem.value = erroApi.message || 'Não foi possível cadastrar a conta.';
  } finally {
    enviando.value = false;
  }
}

function iniciais(valor) {
  return String(valor || 'IG').trim().split(/[\s._-]+/).filter(Boolean).slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase()).join('') || 'IG';
}
</script>

<style scoped>
.contas-page{width:100%;max-width:1150px;margin:0 auto;padding-bottom:32px}.contas-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.contas-header>.botao{white-space:nowrap}
.acoes-cadastro{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:20px}.acao-card{display:flex;align-items:flex-start;gap:15px;min-height:142px;padding:20px;text-align:left;border:1px solid var(--cor-borda);border-radius:12px;background:#fff;cursor:pointer;transition:border-color .15s,box-shadow .15s}.acao-card:hover{border-color:#c5a4d8;box-shadow:0 4px 18px #0000000a}.acao-icone{display:flex;flex:0 0 44px;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;font-size:25px;font-weight:600}.acao-icone--link{background:#f6eafa;color:#8c3cb5}.acao-icone--manual{background:#eaf6ed;color:#287a43}.acao-conteudo{display:flex;flex-direction:column;align-items:flex-start;gap:8px}.acao-conteudo strong{color:var(--cor-titulo);font-size:15px}.acao-conteudo small{max-width:390px;color:var(--cor-texto-suave);font-size:12px;line-height:1.55}.acao-link{margin-top:3px;color:#7e369f;font-size:12px;font-weight:700}.acao-icone--manual+.acao-conteudo .acao-link{color:#287a43}
.resumo-contas{display:flex;flex-direction:column;align-items:flex-start;gap:5px;width:240px;margin-bottom:22px;padding:17px 20px}.resumo-label,.resumo-contas small{color:var(--cor-texto-suave);font-size:12px}.resumo-numero{color:var(--cor-titulo);font-size:28px;line-height:1.2}.lista-card{overflow:hidden}.lista-cabecalho{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:70px;padding:13px 18px;border-bottom:1px solid var(--cor-borda)}.lista-titulo{display:flex;align-items:center;gap:10px}.lista-titulo h2{margin:0;color:var(--cor-titulo);font-size:16px}.contador{display:flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 7px;border-radius:999px;background:#f0f0f0;color:#555;font-size:12px}.pesquisa{position:relative;display:block;width:min(100%,360px)}.pesquisa>span{position:absolute;top:50%;left:12px;color:#888;font-size:20px;transform:translateY(-55%)}.pesquisa .campo{padding:10px 12px 10px 35px;font-size:13px}.contas-lista{display:flex;flex-direction:column}.conta-linha{display:flex;align-items:center;gap:14px;min-height:78px;padding:14px 18px;border-bottom:1px solid #eee}.conta-linha:last-child{border-bottom:0}.avatar-conta{display:flex;flex:0 0 42px;align-items:center;justify-content:center;width:42px;height:42px;border:1px solid #f0d7e7;border-radius:50%;background:linear-gradient(135deg,#fff1e5,#fce7f3 55%,#eee5ff);color:#9b3675;font-size:13px;font-weight:700}.conta-dados{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0}.conta-dados strong{overflow:hidden;color:var(--cor-texto);font-size:14px;text-overflow:ellipsis;white-space:nowrap}.conta-dados>span{overflow:hidden;color:var(--cor-texto-suave);font-size:12px;text-overflow:ellipsis;white-space:nowrap}.status-conta{display:inline-flex;flex:0 0 auto;align-items:center;gap:6px;padding:5px 9px;border:1px solid #ccebd5;border-radius:999px;background:var(--cor-sucesso-fundo);color:var(--cor-sucesso-texto);font-size:11px;font-weight:600}.status-conta i{width:6px;height:6px;border-radius:50%;background:#26994b}.estado{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;min-height:220px;padding:28px;color:var(--cor-texto-suave);font-size:13px;text-align:center}.estado strong{color:var(--cor-texto);font-size:14px}.estado--erro{color:var(--cor-erro-texto)}.estado-icone{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#fce7f3;color:#a33b78;font-size:24px}.lista-rodape{padding:12px 18px;border-top:1px solid #eee;color:var(--cor-texto-suave);font-size:11px}.botao-texto{border:0;background:transparent;color:var(--cor-texto);font-size:12px;text-decoration:underline;cursor:pointer}
.modal-fundo{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:20px;background:#11182780}.modal{width:min(100%,520px);max-height:min(90vh,760px);overflow:auto;border:1px solid var(--cor-borda);border-radius:14px;background:#fff;box-shadow:0 20px 60px #0003}.modal-cabecalho{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;padding:22px 24px;border-bottom:1px solid #eee}.modal-cabecalho h2{margin:0 0 6px;color:var(--cor-titulo);font-size:18px}.modal-cabecalho p{margin:0;color:var(--cor-texto-suave);font-size:12px;line-height:1.5}.fechar-modal{width:30px;height:30px;border:0;border-radius:7px;background:#f4f4f4;color:#555;font-size:22px;line-height:1;cursor:pointer}.modal-form{display:flex;flex-direction:column;gap:17px;padding:22px 24px 24px}.campo-grupo{display:flex;flex-direction:column;gap:7px}.campo-grupo label{color:var(--cor-texto);font-size:13px;font-weight:600}.campo-grupo label span{color:#c53030}.campo-grupo small{color:var(--cor-texto-suave);font-size:11px;line-height:1.45}.username-input{position:relative}.username-input>span{position:absolute;top:50%;left:12px;color:#777;transform:translateY(-50%)}.username-input .campo{padding-left:28px}.aviso-seguranca{padding:12px 14px;border:1px solid #ead8a0;border-radius:8px;background:#fff9e8;color:#765b13;font-size:12px;line-height:1.5}.mensagem-form{margin:0;padding:11px 12px;border-radius:8px;background:#f4f4f4;color:#555;font-size:12px;line-height:1.5}.modal-acoes{display:flex;justify-content:flex-end;gap:9px;padding-top:5px}.modal-acoes .botao{font-size:13px}
@media(max-width:760px){.acoes-cadastro{grid-template-columns:1fr}.lista-cabecalho{align-items:stretch;flex-direction:column}.pesquisa{width:100%}.resumo-contas{width:100%}}@media(max-width:520px){.contas-header{align-items:stretch;flex-direction:column}.contas-header>.botao{align-self:flex-start}.acao-card{padding:16px}.modal-cabecalho,.modal-form{padding-left:17px;padding-right:17px}.conta-linha{padding:13px}.status-conta{padding:5px 7px}}
</style>

<style scoped>
.conta-conexao{display:flex;flex-direction:column;align-items:flex-end;gap:7px}
.conta-conexao small{max-width:260px;color:var(--cor-texto-suave);font-size:11px;text-align:right}
.status-conta--pendente{border-color:#ead8a0;background:#fff9e8;color:#765b13}
.status-conta--pendente i{background:#d6a329}
.status-conta--conectada{border-color:#ccebd5;color:var(--cor-sucesso-texto)}
</style>
