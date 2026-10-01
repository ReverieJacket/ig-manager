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

cp backend/.env.example backend/.env   # preencha os valores
cp frontend/.env.example frontend/.env

npm run login:instagram                # login manual; salva a sessão
npm run verificar:conexao              # testa o Supabase

npm run dev:backend                    # http://localhost:3000
npm run dev:frontend                   # http://localhost:5173
```

## Banco de dados (Supabase)

- `contas_instagram`: `id`, `nome`, `username`, `ativo`
- `publicacoes`: `id`, `conta_id`, `imagem`, `texto`, `data_hora`, `status`, `erro`
  - `status`: `agendada` → `publicando` → `publicada` | `erro`

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Verificação de saúde |
| GET | `/contas` | Contas ativas |
| GET | `/publicacoes` | Publicações com dados da conta |
| POST | `/publicacoes` | Cria (multipart: `imagem`, `texto`, `dataHora`, `conta_id`) |
| GET | `/publicacoes/:id` | Uma publicação |

Erros seguem o formato `{ "sucesso": false, "mensagem": "..." }`.

## Comentários das publicações

O backend lê os comentários de uma publicação no Instagram e os guarda no
Supabase; o ícone ◌ na tela **Postagens** abre um modal com a lista.

**Configuração (uma vez):**

1. Execute no SQL Editor do Supabase, nesta ordem: `backend/db/migrations/001_comentarios.sql`
   e `backend/db/migrations/002_curtidas.sql`.
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
