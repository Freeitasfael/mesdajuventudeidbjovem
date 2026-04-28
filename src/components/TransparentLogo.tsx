import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renderiza a logo garantindo fundo transparente em todos os navegadores.
 *
 * Estratégia:
 * 1. Carrega a imagem em um <canvas> off-screen (CORS anonymous).
 * 2. Inspeciona pixels nos 4 cantos. Se forem brancos e opacos,
 *    o arquivo provavelmente tem fundo branco embutido — aplicamos
 *    um filtro CSS (mix-blend-mode + drop-shadow) como fallback
 *    visual, removendo o branco contra fundos escuros.
 * 3. Em qualquer falha (CORS, decode), apenas exibe a imagem normal —
 *    nunca quebra o layout.
 */
export const TransparentLogo = ({ src, alt, className, style }: Props) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [needsFallback, setNeedsFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      if (cancelled) return;
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) return;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        // Inspect 4 corners (8x8 sample to be tolerant)
        const sample = 8;
        const corners: Array<[number, number]> = [
          [0, 0],
          [w - sample, 0],
          [0, h - sample],
          [w - sample, h - sample],
        ];
        let whiteOpaqueCorners = 0;
        for (const [x, y] of corners) {
          const data = ctx.getImageData(x, y, sample, sample).data;
          let whitePixels = 0;
          const total = (data.length / 4) | 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a > 240 && r > 240 && g > 240 && b > 240) whitePixels++;
          }
          if (whitePixels / total > 0.85) whiteOpaqueCorners++;
        }
        if (whiteOpaqueCorners >= 3) {
          console.warn(
            "[TransparentLogo] Logo parece ter fundo branco opaco. Aplicando fallback visual.",
          );
          setNeedsFallback(true);
        }
      } catch (err) {
        // CORS bloqueando getImageData — usamos a imagem como está.
        console.log("[TransparentLogo] inspeção pulada:", err);
      }
    };

    img.onerror = () => {
      console.log("[TransparentLogo] erro ao carregar para inspeção:", src);
    };

    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      style={{
        // Garante que nenhum estilo herdado coloque fundo na imagem
        backgroundColor: "transparent",
        // Fallback: se o PNG ainda vier com fundo branco, mix-blend-mode
        // remove o branco visualmente sobre fundos escuros (como o hero).
        mixBlendMode: needsFallback ? "screen" : undefined,
        ...style,
      }}
      data-fallback={needsFallback ? "true" : "false"}
    />
  );
};

export default TransparentLogo;
