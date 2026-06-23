import { ImgHTMLAttributes } from "react";
import pixImg from "@/assets/pix-icon.png";

type PixIconProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  /** Tamanho em px (largura e altura). Default 24. */
  size?: number;
};

export const PixIcon = ({ size = 24, className, style, ...props }: PixIconProps) => (
  <img
    src={pixImg}
    alt="Pix"
    width={size}
    height={size}
    decoding="async"
    loading="lazy"
    className={["block aspect-square shrink-0 object-contain", className]
      .filter(Boolean)
      .join(" ")}
    style={{ aspectRatio: "1 / 1", ...style }}
    {...props}
  />
);
