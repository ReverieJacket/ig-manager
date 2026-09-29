/**
 * Seletores e textos da interface do Instagram (em pt-BR).
 *
 * Reunidos aqui porque são a parte mais frágil da automação: quando o
 * Instagram muda a interface, é neste arquivo (e só nele) que se ajusta.
 */

/** Endereço base do Instagram. */
const URL_INSTAGRAM = "https://www.instagram.com/";

/** Tempos em milissegundos. */
const TEMPO = Object.freeze({
    /** Tempo padrão de espera por elementos. */
    padrao: 15000,
    /** Tempo máximo esperando o Instagram confirmar a publicação. */
    confirmacao: 45000,
    /** Tempo máximo de carregamento de página. */
    navegacao: 45000
});

/** Campos que só aparecem quando a sessão NÃO está autenticada. */
const CAMPOS_LOGIN = 'input[name="username"], input[name="password"]';

/** URLs que indicam login ou verificação de segurança pendente. */
const URL_VERIFICACAO = /accounts\/login|challenge|checkpoint/i;

/**
 * Alternativas para localizar o botão "Criar", da mais específica para a
 * mais genérica. Cada `localizar` recebe a página e devolve um Locator.
 */
const BOTOES_CRIAR = [
    { nome: "botão Criar", localizar: (p) => p.getByRole("button", { name: /criar/i }) },
    { nome: "link Criar", localizar: (p) => p.getByRole("link", { name: /criar/i }) },
    { nome: "link de criação", localizar: (p) => p.locator('a[href*="/create/"]') },
    { nome: "elemento aria-label Criar", localizar: (p) => p.locator('[aria-label*="Criar" i]') },
    { nome: "texto Criar", localizar: (p) => p.getByText("Criar", { exact: true }) }
];

/** Possíveis campos de upload de arquivo, do mais específico ao mais genérico. */
const CAMPOS_UPLOAD = [
    'input[type="file"][accept*="image"]',
    'input[type="file"]',
    '[role="presentation"] input[type="file"]'
];

/** Possíveis campos de legenda. Cada item recebe a página. */
const CAMPOS_LEGENDA = [
    (p) => p.getByRole("textbox", { name: /adicione uma legenda/i }),
    (p) => p.locator('textarea[aria-label*="legenda" i]'),
    (p) => p.locator('[contenteditable="true"][aria-label*="legenda" i]'),
    (p) => p.locator('[role="textbox"]')
];

/** Mensagens que o Instagram exibe quando a publicação é concluída. */
const MENSAGENS_SUCESSO = [
    /sua publicação foi compartilhada/i,
    /publicação compartilhada/i,
    /sua publicação foi publicada/i,
    /post foi compartilhado/i,
    /your post has been shared/i,
    /your post has been posted/i,
    /post shared/i
];

const BOTAO_AVANCAR = /^Avançar$/i;
const BOTAO_COMPARTILHAR = /^Compartilhar$/i;
const LINK_NOVO_POST = "Novo post Criar";

module.exports = {
    URL_INSTAGRAM,
    TEMPO,
    CAMPOS_LOGIN,
    URL_VERIFICACAO,
    BOTOES_CRIAR,
    CAMPOS_UPLOAD,
    CAMPOS_LEGENDA,
    MENSAGENS_SUCESSO,
    BOTAO_AVANCAR,
    BOTAO_COMPARTILHAR,
    LINK_NOVO_POST
};
