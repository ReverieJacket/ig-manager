# Conexão do Instagram por navegador remoto (opção B) — viabilidade no AWS EC2

> **Projeto:** IG Manager · **Status:** estudo / proposta, nada implementado
> **Pergunta:** depois que o backend estiver em um servidor, como o **cliente**, em casa,
> faz o login do Instagram dele? E isso funciona num **EC2 da AWS**?

---

## 1. Resumo

**Sim, funciona tecnicamente no EC2.** A ideia é rodar o Chromium do Playwright no servidor
com uma **tela virtual** e **transmitir essa tela para o navegador do cliente**, que digita
o login do Instagram como se estivesse no próprio computador. Quando o login termina, o
backend salva a sessão (`storageState`), exatamente como já faz hoje, e fecha tudo.

O **maior risco não é o EC2**, e sim o Instagram: IPs de datacenter (AWS, GCP, Azure)
costumam disparar **verificações de segurança** ("Foi você?", código por SMS/e-mail) e,
às vezes, bloqueios. A opção B ajuda nisso, porque o próprio cliente vê a tela e
digita o código, mas não elimina o risco.

---

## 2. Por que isso é necessário

Hoje a conexão funciona assim (`backend/src/services/instagram-auth.service.js`):

```
Admin clica "Conectar"  →  backend abre Chromium com JANELA (headless: false)
                         →  alguém digita o login NESSA janela
                         →  backend detecta o login e salva conta-<id>.json
```

Funciona porque o backend roda **na máquina do admin** e a janela abre na tela dele.
Num servidor (EC2) **não existe tela**: a janela não teria onde aparecer e ninguém
conseguiria digitar o login.

---

## 3. Como a opção B funciona

```
 Navegador do cliente (casa)                 Servidor EC2
┌───────────────────────────┐     HTTPS      ┌────────────────────────────────────────────┐
│ IG Manager (Vue)          │  WebSocket     │ nginx (TLS, porta 443)                     │
│ ┌───────────────────────┐ │ ◄────────────► │   └─ /remoto/<token> → ponte de vídeo      │
│ │  janela "ao vivo"     │ │                │                                            │
│ │  do Chromium remoto   │ │   imagens ↓    │ Tela virtual (Xvfb)                        │
│ │  (cliente clica e     │ │   cliques ↑    │   └─ Chromium do Playwright                │
│ │   digita aqui)        │ │                │        └─ instagram.com/accounts/login     │
│ └───────────────────────┘ │                │                                            │
└───────────────────────────┘                │ Backend Node (Express)                     │
                                             │   └─ detecta login → salva storageState    │
                                             └────────────────────────────────────────────┘
```

**Fluxo para o cliente:**

1. Em **Minhas contas**, clica em **Conectar Instagram**.
2. Abre uma janela no IG Manager mostrando a tela de login do Instagram, ao vivo.
3. O cliente digita usuário, senha e, se pedido, o código de verificação.
4. O backend percebe que o login terminou (a verificação de hoje já faz isso), salva a
   sessão, fecha o Chromium e encerra a transmissão.
5. A conta passa para **Conectada**.

O sistema **não lê nem grava a senha**: o cliente digita direto na página do Instagram.

---

## 4. Duas formas de transmitir a tela

| | **B1. VNC (Xvfb + x11vnc + noVNC)** | **B2. Transmissão pelo próprio Chromium (CDP screencast)** |
|---|---|---|
| **Como funciona** | Uma tela virtual Linux (Xvfb) roda o Chromium; o x11vnc transmite essa tela; o noVNC mostra no navegador via WebSocket | O Playwright pede ao Chromium "me mande imagens da página" (`Page.startScreencast`); o backend repassa por WebSocket e devolve cliques e teclas (`Input.dispatch…`) |
| **O que o cliente vê** | A tela inteira do navegador remoto | Só o conteúdo da página |
| **Peças extras no servidor** | `xvfb`, `x11vnc`, `websockify`, `novnc` | Nenhuma (só código Node + Vue) |
| **Esforço** | Menor no início: ferramentas prontas | Maior: é preciso programar a ponte de imagens e de entrada |
| **Controle e segurança** | O cliente controla o navegador inteiro (barra de endereço, abas…) | O cliente só interage com a página; dá para travar em `instagram.com` |
| **Qualidade** | Boa, mais latência | Boa, mais leve |
| **Integração com o código atual** | Rodar o Chromium com `DISPLAY=:99` | Reaproveita o `page` do Playwright que já existe |

**Recomendação:** começar com **B1 (noVNC) como prova de conceito**, porque sobe em
poucas horas e mostra se o Instagram aceita o login vindo do EC2. Se a ideia for adiante,
migrar para **B2**, que é mais seguro (o cliente não sai do Instagram) e mais leve.

> Alternativas prontas, para comparar: **neko** (navegador compartilhado via WebRTC, open
> source), **Kasm Workspaces** e serviços pagos de "navegador na nuvem com visualização
> ao vivo" (Browserless, Browserbase). Elas resolvem a transmissão, mas trazem mais
> dependências ou custo.

---

## 5. Funciona no EC2? Ponto a ponto

| Item | Funciona? | Observações |
|---|---|---|
| Rodar Chromium do Playwright no EC2 | ✅ | Ubuntu 22.04/24.04 + `npx playwright install --with-deps chromium` |
| Tela virtual (Xvfb) | ✅ | Pacote `xvfb`; o Playwright roda com janela dentro dela |
| Transmitir para o navegador (noVNC/WebSocket) | ✅ | Só a porta **443** aberta; o VNC (5900) **nunca** exposto |
| HTTPS | ✅ | nginx + Let's Encrypt (precisa de um domínio) |
| Memória | ⚠️ | Cada Chromium usa ~300–500 MB. Para 1 conexão por vez + backend: **mínimo 2 GB** (ex.: `t3.small`); com folga, 4 GB (`t3.medium`) |
| Várias conexões ao mesmo tempo | ⚠️ | Uma tela virtual por conexão (`:99`, `:100`…), ou uma por vez usando a fila que já existe (`lib/fila.js`) |
| Região | ⚠️ | Use **São Paulo (`sa-east-1`)**: login vindo do Brasil gera menos alerta que de outro país |
| **Aceitação pelo Instagram** | ❗ | IP de datacenter costuma gerar verificação extra ou bloqueio; ver seção 6 |

**Conclusão:** do lado da AWS não há impedimento. O ponto incerto é o Instagram, e
isso só se descobre testando.

---

## 6. Riscos

1. **IP de datacenter.** O Instagram identifica faixas de IP da AWS. Possíveis efeitos:
   pedido de código a cada login, "atividade suspeita", bloqueio temporário da conta.
   *Mitigações:* região `sa-east-1`; o mesmo servidor faz o login **e** as publicações
   (assim a sessão nasce e é usada no mesmo IP); como último recurso, um proxy
   residencial por conta (tem custo e uma questão ética e de termos de uso).
2. **Termos de uso.** Automatizar o Instagram Web já é uma limitação conhecida do
   projeto (está no README). O navegador remoto não muda isso.
3. **Confiança.** O cliente digita a senha num navegador que roda no **nosso** servidor.
   Tecnicamente o servidor *poderia* capturar o que é digitado. O sistema não faz isso,
   mas é preciso ser transparente com o cliente.
4. **Segurança da transmissão.** Sem cuidado, alguém poderia assistir ou controlar a tela
   de outro cliente. Ver a seção 7.

---

## 7. Cuidados obrigatórios de segurança

- **Token de uso único** por conexão, vinculado ao usuário logado e à conta; expira em
  ~10 minutos.
- **Só o dono vê:** o backend confere `req.usuario.cliente.id` antes de abrir a transmissão.
- **VNC/CDP nunca expostos à internet:** apenas `localhost`, acessados pelo nginx/backend.
- **Prender no Instagram:** bloquear navegação para fora de `instagram.com` (no Playwright,
  com `page.route`), e em B1 abrir o Chromium em modo quiosque.
- **Encerrar sempre:** ao concluir, cancelar, ficar inativo (~5 min) ou fechar a aba, o
  Chromium e a tela virtual são encerrados.
- **Um Chromium por conexão, perfil limpo:** sem cookies de outra conta.
- **Registrar** quem conectou qual conta e quando (sem registrar nada digitado).

---

## 8. O que mudaria no projeto

| Parte | Mudança |
|---|---|
| `instagram-auth.service.js` | Iniciar o Chromium dentro de uma tela virtual (B1) ou ligar o screencast (B2); o resto (detectar login, salvar sessão) **continua igual** |
| Novo módulo `tela-remota` | Subir e encerrar Xvfb e x11vnc por conexão (B1) ou a ponte WebSocket (B2) |
| Rotas | `POST /minhas-contas/:id/conectar` (cliente) devolve o endereço da transmissão + token |
| Frontend | Janela "Conectar Instagram" com a tela ao vivo (iframe do noVNC em B1; `<canvas>` em B2) |
| Infra (EC2) | Pacotes `xvfb x11vnc novnc websockify`, nginx com HTTPS, serviço do Node (systemd ou pm2) |

---

## 9. Prova de conceito sugerida (antes de decidir)

Objetivo: descobrir **se o Instagram aceita** o login vindo do EC2, gastando pouco.

1. Subir um EC2 `t3.small`, Ubuntu, região **sa-east-1**.
2. Instalar `xvfb x11vnc novnc websockify` e o Chromium do Playwright.
3. Rodar o `npm run login:instagram` dentro do Xvfb e abrir pelo noVNC (temporariamente,
   protegido por senha e túnel SSH, **sem** expor portas).
4. Fazer login com uma **conta de teste** do Instagram, não com a de um cliente.
5. Tentar **publicar** com a sessão salva, no mesmo servidor, e observar por alguns dias
   se aparecem verificações ou bloqueios.

Se a conta de teste passar sem problemas → seguir com B2 integrado ao sistema.
Se houver bloqueios frequentes → reavaliar (proxy residencial, máquina fixa no
escritório ou a API oficial da Meta).

---

## 10. Comparação rápida com as outras opções

| Opção | Cliente faz de casa? | Senha passa pelo sistema? | Complexidade | Risco de bloqueio |
|---|---|---|---|---|
| A. Formulário com usuário/senha | ✅ | Sim (usada e descartada) | Média | Alto |
| **B. Navegador remoto (este documento)** | ✅ | **Não** (digitada no Instagram) | **Alta** | Médio–alto |
| C. Backend em máquina fixa, admin conecta | ❌ | Não | Baixa | Baixo |
| D. API oficial da Meta | ✅ | Não (OAuth) | Média (aprovação da Meta) | Nenhum |
