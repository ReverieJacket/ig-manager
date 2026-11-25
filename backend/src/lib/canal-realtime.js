/**
 * Cliente mínimo do Supabase Realtime (Broadcast), sem dependências: usa o
 * WebSocket nativo (Node 22 / Electron 36). Serve à tela remota da conexão do
 * Instagram: o Publicador envia as imagens da tela e recebe os toques e o
 * texto de quem está conectando, pelo site.
 *
 * Protocolo Phoenix (vsn 1.0.0) do Realtime. O nome do canal é um segredo
 * gerado pelo backend para cada pedido de conexão; só quem pediu (e o
 * Publicador) o recebe.
 *
 * O site usa uma cópia deste arquivo em `frontend/src/lib/canalRealtime.js`.
 */

const BATIMENTO_MS = 25 * 1000;

class CanalRealtime {
    /**
     * @param {{url: string, chave: string, canal: string,
     *          aoReceber?: (evento: string, dados: object) => void,
     *          aoMudarEstado?: (estado: string) => void}} opcoes
     */
    constructor({ url, chave, canal, aoReceber, aoMudarEstado }) {
        this.endereco =
            `${String(url).replace(/\/+$/, "").replace(/^http/i, "ws")}/realtime/v1/websocket` +
            `?apikey=${encodeURIComponent(chave)}&vsn=1.0.0`;
        this.chave = chave;
        this.topico = `realtime:${canal}`;
        this.aoReceber = aoReceber || (() => {});
        this.aoMudarEstado = aoMudarEstado || (() => {});
        this.ref = 0;
        this.entrou = false;
        this.parado = false;
        this.tentativas = 0;
        this.ws = null;
        this.batimento = null;
    }

    /** Conecta e entra no canal; resolve quando o Realtime confirmar. */
    conectar() {
        return new Promise((resolver, rejeitar) => {
            this._resolverEntrada = resolver;
            this._rejeitarEntrada = rejeitar;
            this._abrir();
        });
    }

    _abrir() {
        if (this.parado) return;
        const ws = new WebSocket(this.endereco);
        this.ws = ws;

        ws.onopen = () => {
            this.tentativas = 0;
            this._enviarBruto({
                topic: this.topico,
                event: "phx_join",
                payload: {
                    config: { broadcast: { ack: false, self: false }, presence: { key: "" }, private: false },
                    access_token: this.chave
                },
                ref: String(++this.ref),
                join_ref: "1"
            });
            this.batimento = setInterval(() => {
                this._enviarBruto({ topic: "phoenix", event: "heartbeat", payload: {}, ref: String(++this.ref) });
            }, BATIMENTO_MS);
        };

        ws.onmessage = (mensagem) => {
            let dados;
            try {
                dados = JSON.parse(typeof mensagem.data === "string" ? mensagem.data : String(mensagem.data));
            } catch {
                return;
            }
            if (dados.topic !== this.topico) return;

            if (dados.event === "phx_reply" && !this.entrou) {
                if (dados.payload?.status === "ok") {
                    this.entrou = true;
                    this.aoMudarEstado("conectado");
                    this._resolverEntrada?.();
                    this._resolverEntrada = this._rejeitarEntrada = null;
                } else {
                    const motivo = dados.payload?.response?.reason || "o Realtime recusou o canal";
                    this._rejeitarEntrada?.(new Error(`Não foi possível abrir a tela remota: ${motivo}.`));
                    this._resolverEntrada = this._rejeitarEntrada = null;
                }
                return;
            }

            if (dados.event === "broadcast" && dados.payload?.event) {
                this.aoReceber(dados.payload.event, dados.payload.payload || {});
            }
        };

        // O WebSocket do Node não dispara "close" quando o aperto de mão falha
        // (só "error"); por isso os dois caminhos levam aqui, uma vez só.
        let tratado = false;
        const aoFechar = () => {
            if (tratado) return;
            tratado = true;
            clearTimeout(limiteEntrada);
            ws.onclose = ws.onerror = ws.onmessage = null;
            try { ws.close(); } catch { /* já fechado */ }
            clearInterval(this.batimento);
            this.entrou = false;
            if (this.parado) return;
            this.aoMudarEstado("reconectando");
            // Primeira conexão falhou de vez: avisa quem esperava.
            if (this._rejeitarEntrada && this.tentativas >= 3) {
                this._rejeitarEntrada(new Error("Não foi possível conectar à tela remota (Supabase Realtime)."));
                this._resolverEntrada = this._rejeitarEntrada = null;
                return;
            }
            const espera = Math.min(10000, 1000 * 2 ** this.tentativas++);
            setTimeout(() => this._abrir(), espera);
        };

        ws.onclose = aoFechar;
        ws.onerror = () => {
            if (ws.readyState !== 1) aoFechar();
        };

        // Sem resposta do Realtime em 15 s: tenta de novo.
        const limiteEntrada = setTimeout(() => {
            if (!this.entrou) aoFechar();
        }, 15000);
    }

    _enviarBruto(objeto) {
        if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(objeto));
    }

    /** Envia um evento para os outros participantes do canal. */
    enviar(evento, dados = {}) {
        if (!this.entrou) return false;
        this._enviarBruto({
            topic: this.topico,
            event: "broadcast",
            payload: { type: "broadcast", event: evento, payload: dados },
            ref: String(++this.ref),
            join_ref: "1"
        });
        return true;
    }

    /** Sai do canal e fecha a conexão. */
    fechar() {
        this.parado = true;
        clearInterval(this.batimento);
        try {
            this._enviarBruto({ topic: this.topico, event: "phx_leave", payload: {}, ref: String(++this.ref) });
            this.ws?.close();
        } catch {
            // já fechado
        }
    }
}

module.exports = { CanalRealtime };
