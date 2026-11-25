# IG Manager

Aplicação para **criar, agendar e publicar posts no Instagram**.
O frontend (Vue) envia imagem + legenda + data ao backend (Express), que guarda
tudo no Supabase. O **Publicador** consulta o banco e, na hora certa, publica no
Instagram Web por meio de automação de navegador (Playwright).

```
Vue (frontend) ──HTTP──▶ Express (API) ──▶ Supabase (Postgres + Storage)
                                                   ▲
            Publicador (computador do admin) ──────┘
                 └──▶ Playwright ──▶ instagram.com
```

No seu computador tudo roda junto (`npm run dev:backend`, modo **completo**). No
ar, o site e a API ficam na **Vercel** (24 h, grátis) e o **Publicador** é um app
no computador do administrador: veja [Colocar no ar](#colocar-no-ar).

## Estrutura

```
ig-manager/
├─ backend/                     API + automação (Node, Express 5, CommonJS)
│  ├─ src/
│  │  ├─ server.js              Entrada: sobe o servidor
│  │  ├─ app.js                 Monta o Express (middlewares + rotas)
│  │  ├─ config/env.js          Único lugar que lê .env e define caminhos
│  │  ├─ routes/                HTTP: valida entrada e escolhe o status
│  │  ├─ validators/            Regras de validação das entradas
│  │  ├─ services/              Regras de negócio (publicar, agendar)
│  │  ├─ repositories/          Acesso ao Supabase (uma tabela por arquivo)
│  │  ├─ automacao/instagram/   Playwright: sessão, passos, seletores
│  │  ├─ middlewares/           Upload (multer) e tratamento de erros
│  │  └─ lib/                   Logger, erros, cliente Supabase
│  │  ├─ publicador/ciclo.js    Publicador: publica o que venceu e atende o site
│  ├─ scripts/                  Login manual no Instagram, teste de conexão,
│  │                            Publicador no terminal
│  └─ storage/                  (gerado, não versionado) uploads, logs, sessão
├─ api/index.js                Entrada da API na Vercel (mesmo Express, modo "api")
├─ publicador/                  App IG Manager Publicador (Electron)
└─ frontend/                    Interface (Vue 3 + Vite + vue-router)
   └─ src/
      ├─ api/                   Chamadas HTTP ao backend
      ├─ composables/           Lógica de estado reutilizável
      ├─ components/            Layout e componentes de publicações
      ├─ views/                 Telas (Postagens, Nova publicação)
      ├─ constants/, utils/     Constantes de domínio e formatadores
      └─ styles/base.css        Variáveis e classes globais
```

## Como rodar

Requisitos: Node 20+.

```bash
npm install
npx playwright install chromium        # uma vez

cp backend/.env.example backend/.env   # preencha os valores (inclusive AUTH_SEGREDO)
cp frontend/.env.example frontend/.env

npm run verificar:conexao              # testa o Supabase
npm run criar:admin                    # cria o primeiro administrador (pede e-mail, nome e senha)
npm run login:instagram                # login manual; salva a sessão

npm run dev:backend                    # http://localhost:3000
npm run dev:frontend                   # http://localhost:5173
```

## Colocar no ar

**Recomendado — Vercel + Publicador:** site e API 24 h na Vercel (grátis); só
publicar e conectar perfis dependem do computador do administrador ligado, com o
app **IG Manager Publicador** aberto. Passo a passo:
[`deploy/vercel/README.md`](deploy/vercel/README.md).

O Publicador é instalado pelo `.exe` em **Releases** (gerado pelo GitHub Actions a
cada tag `publicador-v*`): o administrador instala, entra com o e-mail e a senha do
site (o login fica salvo criptografado, sem a senha) e ele passa a iniciar com o
Windows.

| Modo (`IG_MODO`) | Onde | O que faz |
|---|---|---|
| `completo` (padrão) | seu computador | API + Publicador juntos (desenvolvimento) |
| `api` | Vercel | Só a API; publicar/conectar/coletar viram pedidos ao Publicador |
| `publicador` | app Publicador / `npm run publicador` | Publica o que venceu e atende os pedidos do site |

**Atrasadas:** o que vence com o Publicador desligado (ou o computador dormindo)
**não sai sozinho**: vira *Atrasada* e, ao voltar, o Publicador pergunta se publica
agora ou reagenda (também dá pelo ⋯ em Postagens). Ao fechar o Publicador ou desligar
o Windows, ele avisa quantas publicações estão agendadas e para quais horários.

**Alternativa — Oracle Cloud Always Free** (servidor próprio, quando houver vaga):
[`deploy/oracle/README.md`](deploy/oracle/README.md).

No servidor (sem tela), `CONEXAO_NO_SERVIDOR=false`: o "Conectar" do
Instagram vira **Enviar sessão** — o login é feito no computador com
`npm run login:instagram -- --conta <id>` e o arquivo gerado é enviado em
Clientes → ⋯ → Enviar sessão (`POST /perfis/:id/sessao`, só administrador).

## Banco de dados (Supabase)

- `espacos` (012): cada administrador que se cadastra pelo Publicador ganha um espaço.
  `usuarios`, `clientes`, `contas_instagram`, `convites_contas_instagram`, `publicacoes`
  e `tarefas_automacao` têm `espaco_id`; o backend filtra tudo pelo espaço de quem está
  logado (`lib/espaco.js`). Os dados de antes da 012 ficam no primeiro espaço.
- `publicadores` (012): sinal de vida do Publicador, um por espaço (substitui
  `publicador_estado`)
- `clientes`: `id`, `nome`, `ativo`
- `usuarios`: `id`, `nome`, `email`, `senha_hash`, `perfil` (`admin` | `cliente`), `cliente_id`, `ativo`
- `contas_instagram` (perfis do Instagram): `id`, `nome`, `username`, `ativo`, `cliente_id`,
  `sessao_expirada_em`, `sessao_erro` (preenchidos quando o Instagram pede login de novo),
  `sessao_salva_em` (011: o Publicador tem a sessão salva)
- `publicacoes`: `id`, `conta_id`, `imagem`, `texto`, `data_hora`, `status`, `erro`
  - `status`: `agendada` → `publicando` → `publicada` | `erro`; `agendada` ⇄ `recusada`
    (indeferida pelo cliente); `agendada` → `atrasada` (011: horário perdido com o
    Publicador desligado)
  - aprovação (migração 008): `aprovacao` (`pendente` | `deferida` | `indeferida`; nula =
    publicada na hora), `aprovacao_por`, `aprovacao_pela_equipe`, `aprovacao_em`,
    `aprovacao_categoria`, `aprovacao_motivo`
- `tarefas_automacao` (011): pedidos do site ao Publicador (`conectar`, `desconectar`,
  `coletar_comentarios`)
- `publicador_estado` (011): sinal de vida do Publicador (ligado/desligado)
- Storage `publicacoes` (011): imagens das postagens quando o site está na Vercel

## Perfis de acesso

Todo acesso exige login, exceto o link de convite. Execute no Supabase as migrações
`004_clientes_usuarios.sql`, `005_area_cliente.sql`, `006_excluir_cliente.sql` e
`007_sessao_expirada.sql`, `008_aprovacoes.sql`, `009_cancelar_publicacao.sql`, `010_retomar_publicacao.sql`,
`011_publicador.sql` e `012_espacos.sql`. Administradores novos se cadastram pelo app
Publicador (**Criar conta de administrador**); `npm run criar:admin` cria um administrador
no primeiro espaço (rodar de novo com o mesmo e-mail redefine a senha).

**Espaços:** cada administrador cadastrado pelo Publicador tem o próprio espaço, com os
próprios clientes, perfis, postagens e Publicador; administradores de outros espaços não
veem nada dele. Para dividir o trabalho, ele adiciona outros administradores em
**Equipe** (mesmo espaço, senha provisória no primeiro acesso).

- **Administrador:** Postagens, **Clientes**, Criar e **Equipe**. Em *Clientes* fica tudo de cada
  cliente, em duas abas:
  - *Perfis do Instagram*: adicionar perfil, **Conectar/Reconectar**, desconectar,
    renomear, remover e gerar o **Link para o cliente** (validade de 24 h, 3 ou 7 dias)
    para ele mesmo informar o @;
  - *Usuários*: adicionar, redefinir senha, alterar e-mail, desativar/reativar.

  O cabeçalho do cliente permite renomear, desativar e excluir (lixeira). Em *Criar*
  os perfis aparecem agrupados por cliente, com "Todos os perfis conectados".
- **Cliente** (dono do Instagram): *Minhas postagens* (publicadas e programadas,
  só leitura), *Meus perfis* (informa o @, sem senha, e conecta o perfil — ver `CONEXAO_PELO_CLIENTE`) e *Meu perfil*. Vê apenas
  os dados do próprio cliente. Em *Aprovações* defere ou indefere (com motivo) os
  posts agendados, e pode mudar a resposta até o horário.

**Senhas:** o administrador nunca define nem vê a senha de um cliente. Ao criar um
usuário ou redefinir a senha, o sistema gera uma **senha temporária** (mostrada uma
única vez); no primeiro acesso a pessoa é obrigada a criar a dela.

A senha é guardada com scrypt; a sessão é um token assinado em cookie httpOnly
(8 h, ou 30 dias com "Manter conectado"). Trocar a senha ou o e-mail, redefinir a
senha ou desativar o usuário encerra as sessões abertas dele. Após 5 senhas erradas,
o login daquele e-mail fica bloqueado por 15 minutos.

## API

Rotas sem login: `/`, `/auth/entrar`, `/auth/sair` e o convite
(`GET /contas/convites/:token`, `POST /contas/convites/:token/cadastro`).
Quem está com senha temporária só acessa `/auth/*` até criar a própria senha.

| Método | Rota | Quem | Descrição |
|---|---|---|---|
| GET | `/` | todos | Verificação de saúde |
| POST | `/auth/entrar` | todos | Login (`email`, `senha`, `manterConectado`); grava o cookie |
| POST | `/auth/sair` | todos | Encerra a sessão |
| GET | `/auth/eu` | logado | Usuário logado |
| PATCH | `/auth/eu` | logado | Altera o próprio nome |
| POST | `/auth/trocar-senha` | logado | `senhaAtual`, `senhaNova` (no 1º acesso, só `senhaNova`) |
| GET | `/clientes` | admin | Clientes com contadores |
| POST | `/clientes` | admin | Cria cliente + 1º usuário; devolve a senha temporária |
| GET | `/clientes/:id` | admin | Usuários e perfis do cliente |
| PATCH | `/clientes/:id` | admin | `nome`, `ativo` |
| DELETE | `/clientes/:id` | admin | Exclui de vez cliente, usuários e contas; recusado (409) se alguma conta tiver publicações |
| POST | `/clientes/:id/usuarios` | admin | Novo usuário (senha temporária) |
| POST | `/clientes/:id/perfis` | admin | Adiciona um perfil (`nome`, `username`) |
| POST | `/clientes/:id/link` | admin | Link para o cliente informar o @ (`validadeHoras`: 24, 72 ou 168) |
| GET | `/perfis` | admin | Perfis ativos com cliente e `status` (`conectado`, `aguardando`, `expirada`) |
| GET | `/perfis/atencao` | admin | Perfis com sessão expirada |
| GET | `/perfis/config` | admin | `{ conexaoNoServidor, envioDeSessao, modo, publicador: { online, ultimoSinal } }` |
| POST | `/perfis/:id/sessao` | admin | Multipart `arquivo`: sessão do Instagram gerada pelo `login:instagram` |
| PATCH | `/perfis/:id` | admin | Renomeia (`nome`) |
| DELETE | `/perfis/:id` | admin | Remove; recusado (409) se o perfil tiver publicações |
| PATCH | `/usuarios/:id` | admin | `nome`, `email`, `ativo` (só usuários cliente) |
| POST | `/usuarios/:id/redefinir-senha` | admin | Nova senha temporária |
| GET | `/administradores` | admin | Administradores do mesmo espaço |
| POST | `/administradores` | admin | `nome`, `email` → cria administrador no mesmo espaço (devolve a senha temporária) |
| PATCH | `/administradores/:id` | admin | `nome`, `email`, `ativo` (não desativa a si mesmo) |
| POST | `/administradores/:id/redefinir-senha` | admin | Nova senha temporária |
| POST | `/publicador/entrar` | público | Login do app Publicador (só administrador) → `{ token, usuario }` |
| POST | `/publicador/cadastrar` | público | `nome`, `empresa?`, `email`, `senha` → cria espaço + administrador e já entra |
| GET | `/minha-area/contas` | cliente | Perfis do cliente, com status da conexão |
| POST | `/minha-area/contas` | cliente | Informa um perfil (`nome`, `username`) |
| POST | `/minha-area/contas/:id/conectar` | cliente | Abre o Chromium para o login no Instagram (só perfis do próprio cliente; requer `CONEXAO_PELO_CLIENTE`) |
| GET | `/minha-area/contas/:id/conexao` | cliente | Andamento da conexão |
| GET | `/minha-area/publicacoes` | cliente | Publicadas e programadas dos perfis do cliente |
| GET | `/minha-area/aprovacoes` | cliente | `{ pendentes, respondidas }` |
| POST | `/minha-area/aprovacoes/:id` | cliente | `{ decisao: "deferida" \| "indeferida", categoria, motivo }` |
| POST | `/minha-area/aprovacoes/deferir` | cliente | `{ ids }`: defere várias |
| POST | `/minha-area/aprovacoes/:id/retomar` | cliente | Post sem resposta (até 30 dias): `{ acao: "publicar" }` ou `{ acao: "agendar", dataHora }` |
| GET | `/contas` | admin | Perfis ativos (formato antigo) |
| POST | `/contas/:id/conectar` | admin | Abre o Chromium para o login no Instagram |
| GET / DELETE | `/contas/:id/conexao` | admin | Situação da conexão / desconecta |
| GET | `/publicacoes` | admin | Publicações com dados da conta |
| POST | `/publicacoes` | admin | Cria (multipart: `imagem`, `texto`, `dataHora`, `conta_id`); agendada nasce com aprovação pendente; publicar agora responde 202 e entra na fila do Publicador (recusado se o perfil não estiver conectado ou, na Vercel, com o Publicador desligado) |
| POST | `/publicacoes/:id/retomar` | admin | Sem resposta (em nome do cliente) ou atrasada: `{ acao: "publicar" }` ou `{ acao: "agendar", dataHora }` |
| POST | `/publicacoes/:id/cancelar` | admin | Cancela uma agendada/recusada/atrasada (vira `cancelada`; não apaga) |
| GET | `/tarefas/:id` | admin | Andamento de um pedido ao Publicador (ex.: coleta de comentários) |
| POST | `/publicacoes/:id/aprovacao` | admin | Responde em nome do cliente (mesmo corpo do cliente) |
| GET | `/publicacoes/:id` | admin | Uma publicação |

Erros seguem o formato `{ "sucesso": false, "mensagem": "..." }`.

**Aprovações:** toda publicação *agendada* passa pela aprovação do cliente; *publicar
agora* não. **Só é publicada se estiver deferida**: sem resposta até o horário, o
prazo se esgota e ela vira *Recusada* (não sai, nem com o servidor atrasado). Indeferida
também não é publicada (vira *Recusada*); para mudar o conteúdo, crie outra publicação. O cliente pode trocar a
resposta até o horário, e o administrador pode responder em nome dele (fica
registrado como "pela equipe"). No horário, o Publicador relê o banco e pula as recusadas.
Post **sem resposta** não se perde: fica 30 dias na aba *Sem resposta* (Aprovações do
cliente) e no menu ⋯ de Postagens, com **Publicar agora** (exige o perfil conectado) e
**Agendar** (novo horário, já deferido). Fica registrado quem retomou e o horário original.
O administrador também pode **cancelar** uma agendada (menu ⋯ em Postagens): ela vira
*Cancelada*, fica no histórico e o cliente vê "Cancelada pela equipe".

**Conexão pelo cliente:** com `CONEXAO_PELO_CLIENTE=true` (padrão) o cliente vê o
botão *Conectar* em *Meus perfis*. O Chromium abre **no computador do backend**, então
isso só faz sentido com tudo na mesma máquina; no site da Vercel o botão fica oculto
(o Chromium abriria no computador do Publicador) até existir o navegador remoto.
Desconectar continua só com o administrador.

**Sessão expirada:** se, ao publicar, o Instagram pedir login ou verificação de
novo, o perfil é marcado como *Sessão expirada* (`sessao_expirada_em`). Ele aparece
em vermelho em Clientes, com contador no menu e aviso em Postagens, até ser
reconectado (a marca é limpa ao conectar, desconectar ou publicar com sucesso).

## Comentários das publicações

O backend lê os comentários de uma publicação no Instagram e os guarda no
Supabase; o ícone ◌ na tela **Postagens** abre um modal com a lista.

**Configuração (uma vez):**

1. Execute no SQL Editor do Supabase, nesta ordem: `backend/db/migrations/001_comentarios.sql`,
   `002_curtidas.sql` e `003_respostas_e_curtidas_de_comentarios.sql`.
2. Gere a sessão da conta: `npm run login:instagram -- --conta <id>`.

**Como funciona:**

- Ao publicar, o código do post (`instagram.com/p/<código>/`) é guardado em
  `publicacoes.ig_codigo`. Posts antigos: `PATCH /publicacoes/:id/instagram`
  com `{ "url": "https://www.instagram.com/p/…/" }`.
- `POST /publicacoes/:id/comentarios/coletar` (ou o botão "Atualizar agora")
  abre um navegador, carrega todos os comentários e sincroniza com o banco.
- A sincronização **nunca apaga**: comentário que sumiu é marcado com
  `removido_em`, e só quando a coleta foi completa e não veio vazia.
- `GET /publicacoes/:id/comentarios?pagina=1&limite=30&incluirRemovidos=false`.
- Publicar e coletar usam uma fila: um navegador por vez.
- **Curtidas:** lidas na mesma visita ao post, sem abrir outro navegador. O valor
  atual fica em `publicacoes.curtidas` e cada coleta gera uma linha em
  `curtidas_historico`. Números abreviados pelo Instagram ("1,2 mil") ficam
  marcados como aproximados (`~`). Se o autor ocultar o contador, o valor
  anterior é mantido: "sem dado" não é "zero curtidas".

- **Respostas a comentários e curtidas de cada comentário** (migração 003): a coleta
  clica em "Ver respostas" até abrir todas e as guarda com o id do comentário pai
  (`ig_comentario_pai_id`). A API devolve cada comentário principal com suas
  `respostas` aninhadas; cada registro traz `eh_resposta` (coluna calculada pelo
  banco) e `resposta_a_username` ("resposta a @fulano"), e o modal mostra o selo
  "↳ resposta a @fulano" nas respostas e "N respostas" no comentário pai; `total` conta só os principais (base da paginação) e
  `total_respostas` as respostas. Uma resposta só é marcada como removida se TODAS
  as respostas foram abertas na coleta. O Instagram não mostra o contador de
  curtidas de um comentário quando são 0, então ausência vale 0. Sem a migração
  003 a coleta continua funcionando, mas sem respostas nem curtidas dos comentários.

## Logs

Usa o [pino](https://getpino.io). Em desenvolvimento a saída é colorida e em uma
linha por evento; com `NODE_ENV=production` é JSON (uma linha por evento).

- `LOG_LEVEL`: `debug` | `info` | `warn` | `error` | `silent`.
- `LOG_EM_ARQUIVO=true`: grava também em `backend/storage/logs/backend.log`.
- Cada requisição HTTP é registrada com um `id` (também devolvido no cabeçalho
  `x-request-id`) para ligar o acesso ao erro correspondente.

## Limitações conhecidas

- **Agendamentos vivem na memória do processo.** Se o backend reiniciar,
  publicações `agendada` não são reativadas.
- **Uma sessão de Instagram por conta, criada manualmente.** Antes de publicar (ou
  coletar comentários) por uma conta, rode `npm run login:instagram -- --conta <id>`;
  isso gera `backend/storage/instagram-sessoes/conta-<id>.json`.
- **Os seletores dependem da interface do Instagram** (em pt-BR). Quebras ocorrem
  quando ela muda; ajuste `backend/src/automacao/instagram/seletores.js`.
- **Automatizar o Instagram Web pode violar os Termos de Uso** e levar a bloqueios.
