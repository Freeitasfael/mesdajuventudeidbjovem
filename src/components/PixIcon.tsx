import { SVGProps } from "react";

export const PixIcon = ({
  color = "#32BCAD",
  className,
  style,
  ...props
}: SVGProps<SVGSVGElement> & { color?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 64 64"
    preserveAspectRatio="xMidYMid meet"
    aria-label="Pix"
    role="img"
    className={["block aspect-square shrink-0", className].filter(Boolean).join(" ")}
    style={{ aspectRatio: "1 / 1", ...style }}
    {...props}
  >
    <path
      fill={color}
      d="M32 7.5c2.85 0 5.54 1.11 7.55 3.13l8.63 8.63h-5.02a12.3 12.3 0 0 0-8.75 3.62L32 25.3l-2.43-2.43a12.3 12.3 0 0 0-8.74-3.62h-5.02l8.63-8.63A10.68 10.68 0 0 1 32 7.5ZM11.14 23.92h9.69c2.05 0 4.06.83 5.51 2.28l3.24 3.24a3.42 3.42 0 0 0 4.84 0l3.24-3.24a7.76 7.76 0 0 1 5.5-2.28h9.7l5.09 5.09a4.23 4.23 0 0 1 0 5.98l-5.09 5.09h-9.7a7.76 7.76 0 0 1-5.5-2.28l-3.24-3.24a3.42 3.42 0 0 0-4.84 0l-3.24 3.24a7.76 7.76 0 0 1-5.51 2.28h-9.69l-5.09-5.09a4.23 4.23 0 0 1 0-5.98l5.09-5.09ZM15.82 44.74h5.01a12.3 12.3 0 0 0 8.74-3.62L32 38.69l2.41 2.43a12.3 12.3 0 0 0 8.75 3.62h5.02l-8.63 8.63a10.68 10.68 0 0 1-15.1 0l-8.63-8.63Z"
    />
  </svg>
);
