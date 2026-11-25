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

## 1. Banco: executar as migrações 011 e 012 (uma vez)

No Supabase, abra **SQL Editor** e cole o conteúdo de
[`backend/db/migrations/011_publicador.sql`](../../backend/db/migrations/011_publicador.sql).
Depois clique em **Run**. A migração cria as tabelas do Publicador, o status
"atrasada" e o bucket de imagens.

Depois rode também a
[`012_espacos.sql`](../../backend/db/migrations/012_espacos.sql) (**antes** de subir a
versão com espaços): ela cria os espaços e coloca tudo o que já existe num espaço só.

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
     | `SUPABASE_ANON_KEY` | chave **anon public** (ou *Publishable key*) em Supabase → Project Settings → API Keys |

   `SUPABASE_ANON_KEY` liga a **tela remota**: quem clica em **Conectar** (cliente
   ou administrador, no celular ou em qualquer computador) vê o Instagram aberto
   no Publicador e faz o login pelo próprio site. A chave anon é pública por
   natureza; nunca coloque a `service_role` no lugar dela. No Supabase, em
   **Realtime → Settings**, deixe **Allow public access** ligado (os canais são
   secretos e de uso único).
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

### Pelo instalador (recomendado)

1. No GitHub do projeto, abra **Releases** e baixe o
   `IG-Manager-Publicador-Setup-x.y.z.exe` da versão mais recente.
2. Execute. Se o Windows mostrar **"O Windows protegeu o computador"**, clique em
   **Mais informações → Executar assim mesmo** (o instalador não tem assinatura
   digital paga; é esperado).
3. Siga o instalador (Avançar → Instalar). Ele cria atalhos na área de trabalho e
   no menu Iniciar e abre o Publicador no fim.
4. Na janela de entrada:
   - **Já tem conta:** informe o **e-mail e a senha de administrador** do site.
   - **Primeira vez:** clique em **Criar conta de administrador** e informe nome,
     empresa (opcional), e-mail e senha. Você ganha um **espaço só seu**, vazio:
     os seus clientes, perfis e postagens. Administradores de outros espaços não
     veem nada dele.

   O endereço do site já vem preenchido (dá para trocar em *Endereço do site*).
   Depois entre no site com o mesmo e-mail e senha para cadastrar os clientes.
5. Pronto: o ícone aparece ao lado do relógio (às vezes escondido na setinha
   **^**) e o site passa a mostrar o Publicador ligado.

- **Login salvo:** o Publicador não guarda a senha. Ele guarda um acesso de
  180 dias, criptografado pelo próprio Windows (só abre neste usuário deste
  computador). Trocar a senha no site derruba esse acesso; o Publicador pede o
  login de novo.
- **Só administradores** entram no Publicador; os clientes usam só o site.
  Usuário com senha provisória precisa trocá-la no site primeiro.
- **Mais de um administrador no mesmo espaço:** no site, em **Equipe**, adicione a
  pessoa (nome e e-mail). Ela recebe uma senha provisória, cria a própria senha no
  primeiro acesso e passa a ver os mesmos clientes. Use **um Publicador por
  espaço**.
- **Inicia sozinho com o Windows** (padrão). Para desligar: botão direito no
  ícone → desmarque **Iniciar com o Windows**. A escolha fica salva.
- **Navegador:** o instalado usa o **Microsoft Edge** que já vem no Windows para
  publicar e conectar perfis; não precisa baixar o Chromium.
- **Perfis:** as sessões do Instagram ficam em
  `%APPDATA%\IG Manager Publicador\dados`. Quem usava o Publicador pelo
  `npm start` precisa **conectar os perfis de novo** uma vez (site → Clientes →
  Conectar).
- **Atualizar:** baixe o instalador da versão nova e execute por cima; login e
  perfis são mantidos.
- **Desinstalar:** Configurações do Windows → Aplicativos → IG Manager
  Publicador.

### Gerar uma versão nova do instalador

Quem mantém o código: aumente `version` em `publicador/package.json`, faça o
commit e crie a tag `publicador-vX.Y.Z` (ex.: `git tag publicador-v1.0.1` e
`git push origin publicador-v1.0.1`). O GitHub Actions
(`.github/workflows/publicador.yml`) monta o `.exe` no Windows e publica em
**Releases**. Também dá para rodar o workflow pela aba **Actions → Run
workflow**; nesse caso o `.exe` fica nos *Artifacts* da execução.

Para gerar no próprio computador: `cd publicador`, `npm install`,
`npm run instalador` → o `.exe` sai em `publicador\dist`.

### Pelo código (desenvolvimento)

```powershell
git pull
npm install
npx playwright install chromium

cd publicador
npm install
npm start
```

Pede o mesmo login. Os registros ficam em `backend\storage\logs`.

> **Use um Publicador só.** Com o app aberto, **não** rode
> `npm run dev:backend` ao mesmo tempo. Se quiser testar o site localmente,
> coloque `IG_MODO=api` no `backend\.env`.

## 4. No dia a dia

| Situação | O que acontece |
|---|---|
| **Conectar um perfil** (Clientes → Conectar, ou o cliente em Meus perfis) | Com `SUPABASE_ANON_KEY`: o Instagram aparece **no site de quem clicou**, que faz o login por ali (o Publicador precisa estar ligado). Sem ela: o navegador abre no computador do Publicador |
| **Publicar agora** | Entra na fila e sai em instantes; o resultado aparece em Postagens |
| **Fechar o Publicador / desligar o Windows** | Aviso com quantas publicações estão agendadas e para quais horários: com ele desligado, elas **não serão publicadas** |
| **Ligar de novo** | Se algo venceu nesse tempo, ele pergunta: **Publicar agora** ou **Reagendar** |
| **Computador dormiu** | O que venceu durante o sono também vira *Atrasada* |
| **Publicador desligado** | O site mostra um aviso no topo para o administrador |

Menu do ícone (botão direito):

- Conta (quem está conectado) / Entrar…
- Abrir o site
- Próximas publicações
- Publicações atrasadas
- Iniciar com o Windows
- Abrir a pasta de registros
- Sair da conta
- Fechar o Publicador

## Problemas comuns

| Problema | Solução |
|---|---|
| Site mostra "Publicador desligado" com o app aberto | Confira a internet do computador e se a migração 011 foi executada; veja os registros (menu do ícone → Abrir a pasta de registros) |
| Publicador pede login toda hora | A senha foi trocada no site ou o usuário deixou de ser administrador; entre de novo |
| "Só administradores podem usar o Publicador" | Entre com uma conta de administrador; se a senha for provisória, troque no site antes |
| Conectar/publicar não abre o navegador | Confira se o Microsoft Edge está instalado e atualizado |
| "Função indisponível: execute a migração 011" | Rode a migração 011 no Supabase |
| Imagem não aparece no site | Rode a migração 011 (cria o bucket `publicacoes`) |
| Login no site não fica salvo | Confira `NODE_ENV=production` e `AUTH_SEGREDO` na Vercel |

## Custos e limites

- **Vercel Hobby:** grátis, mas destinado a uso pessoal ou não comercial. Se o
  sistema for usado comercialmente com clientes, o adequado é o plano Pro (pago).
- **Supabase Free:** até 500 MB de banco e 1 GB de arquivos.
- As imagens grandes são reduzidas no navegador antes do envio, porque a Vercel
  aceita até cerca de 4 MB por envio.
