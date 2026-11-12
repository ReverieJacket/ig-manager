# Colocar o IG Manager no ar na Oracle Cloud (Always Free)

Passo a passo para subir o sistema numa máquina gratuita da Oracle, sem domínio
próprio. O endereço fica assim: `https://<IP-com-traços>.sslip.io` (gratuito,
com HTTPS automático).

| Arquivo | Para que serve |
|---|---|
| `cloud-init.sh` | Colado no painel da Oracle ao criar a máquina: dispara a instalação automática |
| `instalar.sh` | Instala tudo (Node, Chromium, Caddy...), gera o site e configura o HTTPS |
| `configurar.sh` | Pede as chaves do Supabase e liga o backend |
| `atualizar.sh` | Atualiza o servidor com o que está no GitHub |

> **Atenção:** o servidor e o seu computador usam o mesmo banco. **Nunca deixe
> os dois backends ligados ao mesmo tempo**, porque os agendamentos sairiam em
> dobro. Com o servidor no ar, quem publica é ele.

---

## 1. Criar a máquina (painel da Oracle)

1. **☰ → Compute → Instances → Create instance**.
2. **Name:** `ig-manager`.
3. **Image:** *Change image* → **Canonical Ubuntu 22.04**.
4. **Shape:** *Change shape* → **Ampere** → **VM.Standard.A1.Flex** →
   **2 OCPUs** e **12 GB** de memória.
   *"Out of capacity"?* Tente 1 OCPU e 6 GB, ou de novo mais tarde.
5. **Add SSH keys:** *Generate a key pair for me* → **Save private key**.
   Guarde o arquivo em `C:\oracle\chave.key`.
6. **Show advanced options → Management → Paste cloud-init script:** cole o
   conteúdo de [`cloud-init.sh`](cloud-init.sh).
7. **Create.** Quando ficar **Running**, anote o **Public IP address**.

## 2. Abrir as portas do site (painel da Oracle)

Na instância: link da **Subnet** → **Security Lists** → **Default Security
List** → **Add Ingress Rules**:

- **Source CIDR:** `0.0.0.0/0`
- **IP Protocol:** TCP
- **Destination Port Range:** `80,443`

## 3. Esperar a instalação (~15 minutos)

A máquina instala tudo sozinha. Para acompanhar, entre por SSH (passo 4) e rode:

```bash
tail -f /var/log/ig-manager-instalacao.log
```

Pronto quando aparecer **"Instalação concluída"** (Ctrl+C sai do log).

## 4. Entrar na máquina (PowerShell do seu computador)

```powershell
ssh -i C:\oracle\chave.key ubuntu@SEU_IP
```

- *"Are you sure you want to continue connecting"* → `yes`.
- Erro de permissão da chave ("UNPROTECTED PRIVATE KEY FILE"):
  ```powershell
  icacls C:\oracle\chave.key /inheritance:r /grant:r "$($env:USERNAME):R"
  ```

## 5. Configurar e ligar (uma vez)

```bash
bash ~/ig-manager/deploy/oracle/configurar.sh
```

Ele pede **SUPABASE_URL** e **SUPABASE_SERVICE_ROLE_KEY** (copie do
`backend\.env` do seu computador; para colar no terminal, use o botão direito
do mouse), testa a conexão com o banco, liga o backend e mostra o endereço do
site. Entre com o mesmo e-mail e senha de administrador de sempre.

## 6. Conectar os perfis do Instagram

O servidor não tem tela, então o login no Instagram é feito **no seu
computador** e o arquivo da sessão é enviado **pelo próprio site**:

1. No seu computador, na pasta do projeto (o **id** aparece na janela de
   envio do site):
   ```powershell
   npm run login:instagram -- --conta 7
   ```
   Entre no Instagram na janela do Chromium e espere salvar.
2. No site, em **Clientes → perfil → ⬆ Enviar sessão** (ou **⋯ → Enviar
   sessão**), escolha `backend\storage\instagram-sessoes\conta-7.json`.
3. O perfil fica **Conectado** e passa a publicar pelo servidor.

Se o perfil aparecer como **Sessão expirada**, repita os passos 1 e 2.

## Atualizar depois de mudanças no GitHub

```bash
bash ~/ig-manager/deploy/oracle/atualizar.sh
```

## Comandos úteis

| Para | Comando |
|---|---|
| Ver os logs do backend | `pm2 logs ig-backend` |
| Reiniciar o backend | `pm2 restart ig-backend` |
| Ver se está ligado | `pm2 status` |
| Ver o endereço do site | `cat /etc/ig-manager/endereco` |
| Log da instalação | `less /var/log/ig-manager-instalacao.log` |
