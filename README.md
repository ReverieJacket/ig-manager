# IG Manager

Aplicação para **criar, agendar e publicar posts no Instagram**.
O frontend (Vue) envia imagem + legenda + data ao backend (Express), que guarda
tudo no Supabase e, na hora certa, publica no Instagram Web por meio de
automação de navegador (Playwright).

```
Vue (frontend) ──HTTP──▶ Express (backend) ──▶ Supabase (Postgres)
                              │
                              └──▶ Playwright ──▶ instagram.com
```

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
│  ├─ scripts/                  Login manual no Instagram, teste de conexão
│  └─ storage/                  (gerado, não versionado) uploads, logs, sessão
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

## Banco de dados (Supabase)

- `clientes`: `id`, `nome`, `ativo`
- `usuarios`: `id`, `nome`, `email`, `senha_hash`, `perfil` (`admin` | `cliente`), `cliente_id`, `ativo`
- `contas_instagram` (perfis do Instagram): `id`, `nome`, `username`, `ativo`, `cliente_id`,
  `sessao_expirada_em`, `sessao_erro` (preenchidos quando o Instagram pede login de novo)
- `publicacoes`: `id`, `conta_id`, `imagem`, `texto`, `data_hora`, `status`, `erro`
  - `status`: `agendada` → `publicando` → `publicada` | `erro`

## Perfis de acesso

Todo acesso exige login, exceto o link de convite. Execute no Supabase as migrações
`004_clientes_usuarios.sql`, `005_area_cliente.sql`, `006_excluir_cliente.sql` e
`007_sessao_expirada.sql` e crie o primeiro administrador
com `npm run criar:admin` (rodar de novo com o mesmo e-mail redefine a senha).

- **Administrador:** Postagens, **Clientes** e Criar. Em *Clientes* fica tudo de cada
  cliente, em duas abas:
  - *Perfis do Instagram*: adicionar perfil, **Conectar/Reconectar**, desconectar,
    renomear, remover e gerar o **Link para o cliente** (validade de 24 h, 3 ou 7 dias)
    para ele mesmo informar o @;
  - *Usuários*: adicionar, redefinir senha, alterar e-mail, desativar/reativar.

  O cabeçalho do cliente permite renomear, desativar e excluir (lixeira). Em *Criar*
  os perfis aparecem agrupados por cliente, com "Todos os perfis conectados".
- **Cliente** (dono do Instagram): *Minhas postagens* (publicadas e programadas,
  só leitura), *Meus perfis* (informa o @, sem senha) e *Meu perfil*. Vê apenas
  os dados do próprio cliente. "Aprovações" chega na próxima etapa.

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
| PATCH | `/perfis/:id` | admin | Renomeia (`nome`) |
| DELETE | `/perfis/:id` | admin | Remove; recusado (409) se o perfil tiver publicações |
| PATCH | `/usuarios/:id` | admin | `nome`, `email`, `ativo` (só usuários cliente) |
| POST | `/usuarios/:id/redefinir-senha` | admin | Nova senha temporária |
| GET | `/minha-area/contas` | cliente | Perfis do cliente, com status da conexão |
| POST | `/minha-area/contas` | cliente | Informa um perfil (`nome`, `username`) |
| GET | `/minha-area/publicacoes` | cliente | Publicadas e programadas dos perfis do cliente |
| GET | `/contas` | admin | Perfis ativos (formato antigo) |
| POST | `/contas/:id/conectar` | admin | Abre o Chromium para o login no Instagram |
| GET / DELETE | `/contas/:id/conexao` | admin | Situação da conexão / desconecta |
| GET | `/publicacoes` | admin | Publicações com dados da conta |
| POST | `/publicacoes` | admin | Cria (multipart: `imagem`, `texto`, `dataHora`, `conta_id`); publicar agora é recusado (400) se o perfil não estiver conectado |
| GET | `/publicacoes/:id` | admin | Uma publicação |

Erros seguem o formato `{ "sucesso": false, "mensagem": "..." }`.

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
