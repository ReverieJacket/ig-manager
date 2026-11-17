/**
 * Reduz imagens grandes antes de enviar.
 *
 * O site publicado na Vercel recusa envios acima de ~4 MB. O Instagram
 * exibe no máximo 1080 px de largura, então reduzir para 2048 px (lado
 * maior) em JPEG não muda a qualidade do post.
 */

/** Acima disso a imagem é reduzida. */
const LIMITE_BYTES = 3.5 * 1024 * 1024;
const LADO_MAXIMO = 2048;

function carregar(arquivo) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolver(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error("Não foi possível ler a imagem.")); };
    img.src = url;
  });
}

function paraJpeg(canvas, qualidade) {
  return new Promise((resolver) => canvas.toBlob(resolver, "image/jpeg", qualidade));
}

/**
 * Devolve a própria imagem se já for pequena; senão, uma versão JPEG
 * reduzida (abaixo de ~3,5 MB).
 *
 * @param {File} arquivo
 * @returns {Promise<File>}
 */
export async function prepararImagem(arquivo) {
  if (!arquivo || arquivo.size <= LIMITE_BYTES) return arquivo;

  const img = await carregar(arquivo);
  let lado = LADO_MAXIMO;
  let qualidade = 0.9;

  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);

    const contexto = canvas.getContext("2d");
    // Fundo branco: PNG com transparência não fica preto no JPEG.
    contexto.fillStyle = "#fff";
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await paraJpeg(canvas, qualidade);
    if (blob && blob.size <= LIMITE_BYTES) {
      const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
      return new File([blob], nome, { type: "image/jpeg" });
    }

    lado = Math.round(lado * 0.8);
    qualidade = Math.max(0.7, qualidade - 0.05);
  }

  throw new Error("A imagem é grande demais. Escolha uma imagem menor.");
}
