# Colocar o IG Manager no ar: Vercel + Publicador

O **site** (telas e API) fica na Vercel, no ar 24 horas e de graça. O
**Publicador**, um app no computador do administrador, é quem fala com o
Instagram.

```
Cliente / Admin ──▶ Site na Vercel (24 h) ──▶ Supabase (24 h)
                                                  ▲
               Publicador (seu computador) ───────┘──▶ Instagram
```

| Com o computador do Publicador **desligado** | Funciona? |
|---|---|
| Convite, cadastro, login, ver postagens, deferir/indeferir | ✅ |
| Admin criar, agendar, cancelar postagens e gerar convites | ✅ |
| Publicar (agendado ou agora), conectar perfis, coletar comentários | ⏸️ Só com ele ligado |

O que venceu com o Publicador desligado **não sai sozinho**: vira *Atrasada*. Ao
abrir, o Publicador pergunta se publica agora ou reagenda. Também dá para fazer
isso pelo ⋯ em Postagens.

---

## 1. Banco: executar a migração 011 (uma vez)

No Supabase, abra **SQL Editor** e cole o conteúdo de
[`backend/db/migrations/011_publicador.sql`](../../backend/db/migrations/011_publicador.sql).
Depois clique em **Run**. A migração cria as tabelas do Publicador, o status
"atrasada" e o bucket de imagens.

## 2. Criar o site na Vercel

1. Entre em <https://vercel.com/signup> e escolha **Continue with GitHub**. O
   plano é o **Hobby** (grátis).
2. **Add New… → Project**. Na lista, escolha o repositório **ig-manager** e
   clique em **Import**.
   - O repositório não aparece? Clique em **Adjust GitHub App Permissions** e
     libere o acesso a ele. Se ele for de outra conta (do Marcus, por exemplo),
     o dono precisa liberar.
3. Na tela de configuração:
   - **Framework Preset:** `Other`. O `vercel.json` do projeto já diz o que fazer.
   - **Root Directory:** deixe `./`.
   - Abra **Environment Variables** e adicione as variáveis abaixo. Os valores
     estão no `backend\.env` do seu computador.

     | Nome | Valor |
     |---|---|
     | `SUPABASE_URL` | o mesmo do `backend\.env` |
     | `SUPABASE_SERVICE_ROLE_KEY` | o mesmo do `backend\.env` |
     | `AUTH_SEGREDO` | o mesmo do `backend\.env` |
     | `NODE_ENV` | `production` |
     | `IG_MODO` | `api` |
     | `CONEXAO_PELO_CLIENTE` | `false` |

4. Clique em **Deploy** e espere 1 a 2 minutos. O endereço vai aparecer, algo
   como `https://ig-manager-xxxx.vercel.app`.
5. Volte em **Settings → Environment Variables**, adicione
   `FRONTEND_URL` = o endereço do passo 4 (sem `/` no final) e faça um
   **Redeploy** (Deployments → ⋯ → Redeploy). Esse endereço é o usado nos
   links de convite.

**Qual branch vai para o ar?** A Vercel publica a branch principal (`main`).
Para publicar outra, use **Settings → Git → Production Branch** (por exemplo,
`dev/bruno`). Cada `git push` nessa branch atualiza o site sozinho.

**Teste:** abra `https://SEU-ENDERECO/api`. Deve aparecer
`"Backend do IG Manager funcionando!"`. Depois entre no site com o e-mail e a
senha de administrador de sempre.

## 3. Instalar o Publicador no computador do administrador (Windows)

No PowerShell, na pasta do projeto:

```powershell
git pull
npm install
npx playwright install chromium

cd publicador
npm install
npm start
```

- Um **ícone azul com uma seta** aparece ao lado do relógio (às vezes fica
  escondido na setinha **^**). Pronto: o site passa a mostrar o Publicador
  ligado.
- Ele **inicia sozinho com o Windows**. Para desligar isso: clique com o botão
  direito no ícone e desmarque **Iniciar com o Windows**.
- No `backend\.env`, coloque `PUBLICADOR_SITE_URL=https://SEU-ENDERECO` para o
  item **Abrir o site** do menu do ícone funcionar.
- Os perfis que já estavam conectados neste computador são reconhecidos
  sozinhos.

> **Use um Publicador só.** Com o app aberto, **não** rode
> `npm run dev:backend` ao mesmo tempo. Se quiser testar o site localmente,
> coloque `IG_MODO=api` no `backend\.env`.

## 4. No dia a dia

| Situação | O que acontece |
|---|---|
| **Conectar um perfil** (site → Clientes → Conectar) | O Chromium abre **no computador do Publicador** para o login no Instagram |
| **Publicar agora** | Entra na fila e sai em instantes; o resultado aparece em Postagens |
| **Fechar o Publicador / desligar o Windows** | Aviso com quantas publicações estão agendadas e para quais horários: com ele desligado, elas **não serão publicadas** |
| **Ligar de novo** | Se algo venceu nesse tempo, ele pergunta: **Publicar agora** ou **Reagendar** |
| **Computador dormiu** | O que venceu durante o sono também vira *Atrasada* |
| **Publicador desligado** | O site mostra um aviso no topo para o administrador |

Menu do ícone (botão direito):

- Próximas publicações
- Publicações atrasadas
- Abrir o site
- Iniciar com o Windows
- Abrir a pasta de registros (`backend\storage\logs`)
- Sair

## Problemas comuns

| Problema | Solução |
|---|---|
| Site mostra "Publicador desligado" com o app aberto | Confira a internet do computador e se a migração 011 foi executada; veja os registros em `backend\storage\logs\backend.log` |
| "Função indisponível: execute a migração 011" | Rode a migração 011 no Supabase |
| Erro ao abrir o app: variáveis ausentes | O `backend\.env` precisa ter `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` |
| Imagem não aparece no site | Rode a migração 011 (cria o bucket `publicacoes`) |
| Login no site não fica salvo | Confira `NODE_ENV=production` e `AUTH_SEGREDO` na Vercel |

## Custos e limites

- **Vercel Hobby:** grátis, mas destinado a uso pessoal ou não comercial. Se o
  sistema for usado comercialmente com clientes, o adequado é o plano Pro (pago).
- **Supabase Free:** até 500 MB de banco e 1 GB de arquivos.
- As imagens grandes são reduzidas no navegador antes do envio, porque a Vercel
  aceita até cerca de 4 MB por envio.
