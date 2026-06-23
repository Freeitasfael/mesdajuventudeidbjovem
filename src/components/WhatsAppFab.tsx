import { MessageCircle } from "lucide-react";

interface WhatsAppFabProps {
  message: string;
  /** Offset extra do bottom (px) — útil quando há barra fixa */
  bottomOffset?: number;
}

const PHONE = "5534992756882";

export const WhatsAppFab = ({ message, bottomOffset = 0 }: WhatsAppFabProps) => {
  const href = `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="group fixed right-4 sm:right-6 z-[9998] flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 font-bold text-white shadow-[0_10px_30px_rgba(37,211,102,0.45)] transition-transform hover:scale-105 active:scale-95"
      style={{ bottom: `${16 + bottomOffset}px` }}
    >
      <MessageCircle className="h-6 w-6" fill="white" strokeWidth={0} />
      <span className="hidden text-sm sm:inline">Fale conosco</span>
    </a>
  );
};
