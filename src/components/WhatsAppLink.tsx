import { MessageCircle } from "lucide-react";

interface WhatsAppLinkProps {
  phone?: string | null;
  message?: string;
  /** Quando true, exibe apenas o ícone (sem o número ao lado). */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Botão/atalho para abrir o WhatsApp do telefone informado.
 * - Limpa caracteres não numéricos
 * - Adiciona DDI 55 (Brasil) quando o número tem 10/11 dígitos
 * - Retorna `null` se o telefone for inválido
 */
export function WhatsAppLink({ phone, message, iconOnly = false, className = "" }: WhatsAppLinkProps) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;

  const withDdi = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  const href = `https://wa.me/${withDdi}${text}`;

  if (iconOnly) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`Abrir WhatsApp (${phone})`}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400 transition-colors ${className}`}
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Abrir conversa no WhatsApp"
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400 transition-colors ${className}`}
    >
      <MessageCircle className="h-3.5 w-3.5" />
      <span className="whitespace-nowrap">{phone}</span>
    </a>
  );
}
