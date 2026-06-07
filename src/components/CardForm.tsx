import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, CreditCard, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * Inline credit card form powered by Mercado Pago JS SDK v2 (`cardForm`).
 * - Tokenizes the card on the client (PCI-safe, never sends raw card to our backend).
 * - Auto-detects brand, fetches installment options from MP.
 * - On submit, calls `onTokenized` with everything the backend needs.
 */
export interface CardTokenPayload {
  card_token: string;
  installments: number;
  payment_method_id: string;
  issuer_id: string | null;
  payer_email: string;
  payer_doc_type: string;
  payer_doc_number: string;
}

type Account = "rifa" | "entrada";

interface Props {
  account: Account;
  /** Amount in BRL (reais, not cents). */
  amount: number;
  submitting?: boolean;
  errorMessage?: string | null;
  /** Style variant: light (default, on light surfaces) or dark (on hero/black). */
  variant?: "light" | "dark";
  onTokenized: (payload: CardTokenPayload) => void | Promise<void>;
}

declare global {
  interface Window {
    MercadoPago?: new (key: string, opts?: { locale?: string }) => {
      cardForm: (opts: Record<string, unknown>) => {
        getCardFormData: () => {
          token: string;
          installments: string;
          paymentMethodId: string;
          issuerId: string;
          cardholderEmail: string;
          identificationNumber: string;
          identificationType: string;
        };
        unmount: () => void;
      };
    };
  }
}

const SDK_SRC = "https://sdk.mercadopago.com/js/v2";

const loadSdk = (): Promise<void> => {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.MercadoPago) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("sdk_load_failed")));
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("sdk_load_failed"));
    document.head.appendChild(s);
  });
};

let publicKeyCache: { rifa: string | null; entrada: string | null } | null = null;
const getPublicKey = async (account: Account): Promise<string> => {
  if (!publicKeyCache) {
    const { data, error } = await supabase.functions.invoke("mp-public-key", { body: {} });
    if (error || !data) throw new Error("public_key_unavailable");
    publicKeyCache = data as { rifa: string | null; entrada: string | null };
  }
  const key = publicKeyCache[account];
  if (!key) throw new Error("public_key_missing");
  return key;
};

/**
 * Cross-browser styled wrapper around a native <select>. The native element
 * is kept in the DOM (so MP SDK can read/write its value) but is visually
 * hidden behind a fully themed custom dropdown. Selections sync both ways via
 * a MutationObserver and a synthetic `change` event.
 */
interface StyledNativeSelectProps {
  id: string;
  isDark: boolean;
  placeholder?: string;
  className?: string;
}
function StyledNativeSelect({ id, isDark, placeholder, className }: StyledNativeSelectProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{ value: string; label: string; disabled: boolean }[]>([]);
  const [selectedValue, setSelectedValue] = useState<string>("");

  const sync = useCallback(() => {
    const sel = document.getElementById(id) as HTMLSelectElement | null;
    if (!sel) return;
    const opts = Array.from(sel.options).map((o) => ({
      value: o.value,
      label: o.textContent ?? o.value,
      disabled: o.disabled,
    }));
    setOptions(opts);
    setSelectedValue(sel.value);
  }, [id]);

  useEffect(() => {
    const sel = document.getElementById(id) as HTMLSelectElement | null;
    if (!sel) return;
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(sel, { childList: true, subtree: true, attributes: true });
    const onChange = () => sync();
    sel.addEventListener("change", onChange);
    return () => {
      mo.disconnect();
      sel.removeEventListener("change", onChange);
    };
  }, [id, sync]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const pick = (value: string) => {
    const sel = document.getElementById(id) as HTMLSelectElement | null;
    if (!sel) return;
    sel.value = value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    setSelectedValue(value);
    setOpen(false);
  };

  const selectedLabel = options.find((o) => o.value === selectedValue)?.label || placeholder || "Selecione";

  const triggerCls = isDark
    ? "w-full h-11 rounded-md border border-white/15 bg-white/5 px-3 pr-9 text-sm text-white flex items-center justify-between cursor-pointer hover:border-[hsl(var(--hero-gold)/0.5)] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--hero-gold))]"
    : "w-full h-11 rounded-md border border-input bg-background px-3 pr-9 text-sm text-foreground flex items-center justify-between cursor-pointer hover:border-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring";

  const panelCls = isDark
    ? "absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-white/15 bg-[hsl(0_0%_8%)] shadow-xl py-1"
    : "absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-input bg-popover shadow-xl py-1";

  const itemCls = (active: boolean, disabled: boolean) =>
    [
      "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors",
      disabled ? "opacity-40 pointer-events-none" : "",
      active
        ? "bg-[hsl(var(--hero-gold))] text-[hsl(var(--hero-bg))] font-semibold"
        : isDark
          ? "text-white hover:bg-[hsl(var(--hero-gold)/0.2)]"
          : "text-foreground hover:bg-muted",
    ].join(" ");

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`}>
      {/* Real native select kept for MP SDK; visually hidden but focusable for forms */}
      <select
        id={id}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          pointerEvents: "none",
          width: "100%",
          height: "100%",
        }}
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={triggerCls}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selectedValue ? "" : isDark ? "text-white/40" : "text-muted-foreground"}>
          {selectedLabel}
        </span>
        <ChevronDown
          className="h-4 w-4 ml-2 transition-transform"
          style={{
            color: isDark ? "hsl(var(--hero-gold))" : undefined,
            transform: open ? "rotate(180deg)" : undefined,
          }}
        />
      </button>
      {open && options.length > 0 && (
        <ul role="listbox" className={panelCls}>
          {options.map((o) => {
            const active = o.value === selectedValue;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={active}
                onClick={() => !o.disabled && pick(o.value)}
                className={itemCls(active, o.disabled)}
              >
                <Check className={`h-4 w-4 ${active ? "opacity-100" : "opacity-0"}`} />
                <span className="flex-1">{o.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}



export function CardForm({
  account,
  amount,
  submitting,
  errorMessage,
  variant = "light",
  onTokenized,
}: Props) {
  const formId = useRef(`mp-card-form-${Math.random().toString(36).slice(2, 9)}`).current;
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const cardFormRef = useRef<ReturnType<NonNullable<Window["MercadoPago"]>["prototype"]["cardForm"]> | null>(null);

  // Initialise SDK + cardForm once amount is known
  useEffect(() => {
    let cancelled = false;
    let mountedForm: ReturnType<NonNullable<Window["MercadoPago"]>["prototype"]["cardForm"]> | null = null;

    (async () => {
      try {
        await loadSdk();
        const key = await getPublicKey(account);
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(key, { locale: "pt-BR" });

        mountedForm = mp.cardForm({
          amount: String(amount.toFixed(2)),
          iframe: true,
          autoMount: true,
          form: {
            id: formId,
            cardNumber: { id: `${formId}-cardNumber`, placeholder: "Número do cartão" },
            expirationDate: { id: `${formId}-expirationDate`, placeholder: "MM/AA" },
            securityCode: { id: `${formId}-securityCode`, placeholder: "CVV" },
            cardholderName: { id: `${formId}-cardholderName`, placeholder: "Nome impresso no cartão" },
            issuer: { id: `${formId}-issuer`, placeholder: "Banco emissor" },
            installments: { id: `${formId}-installments`, placeholder: "Parcelas" },
            identificationType: { id: `${formId}-identificationType`, placeholder: "Tipo" },
            identificationNumber: { id: `${formId}-identificationNumber`, placeholder: "Número do documento" },
            cardholderEmail: { id: `${formId}-cardholderEmail`, placeholder: "E-mail" },
          },
          callbacks: {
            onFormMounted: (err: unknown) => {
              if (err) {
                console.warn("[CardForm] mount error", err);
                setInitError("Não foi possível carregar o formulário de cartão.");
                return;
              }
              setReady(true);
            },
            onSubmit: async (event: Event) => {
              event.preventDefault();
              if (!mountedForm) return;
              setInternalSubmitting(true);
              try {
                const d = mountedForm.getCardFormData();
                if (!d.token) {
                  setInitError("Verifique os dados do cartão.");
                  return;
                }
                await onTokenized({
                  card_token: d.token,
                  installments: Number(d.installments) || 1,
                  payment_method_id: d.paymentMethodId,
                  issuer_id: d.issuerId || null,
                  payer_email: d.cardholderEmail,
                  payer_doc_type: d.identificationType,
                  payer_doc_number: d.identificationNumber,
                });
              } catch (e) {
                console.error("[CardForm] tokenize error", e);
                setInitError(e instanceof Error ? e.message : "Erro ao processar cartão");
              } finally {
                setInternalSubmitting(false);
              }
            },
            onFetching: () => {
              // resource: 'cardToken' | 'installments' | 'issuers' | 'paymentMethods'
              return () => {};
            },
          },
        });
        cardFormRef.current = mountedForm;
      } catch (e) {
        console.error("[CardForm] init failed", e);
        if (!cancelled) {
          setInitError(
            e instanceof Error && e.message === "public_key_missing"
              ? "Chave pública do Mercado Pago não configurada."
              : "Não foi possível inicializar o pagamento por cartão.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      try { mountedForm?.unmount(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, formId]);

  // Theme classes
  const isDark = variant === "dark";
  const labelCls = isDark ? "text-white/80" : "text-foreground";
  const inputBase =
    "w-full h-11 rounded-md border px-3 text-sm focus:outline-none focus:ring-2 transition-colors";
  const inputCls = isDark
    ? `${inputBase} border-white/15 bg-white/5 text-white placeholder:text-white/40 focus:ring-[hsl(var(--hero-gold))] [color-scheme:dark]`
    : `${inputBase} border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring`;
  // Native <select> needs explicit appearance reset + caret so dropdown stays compact
  const selectCls = `${inputCls} appearance-none bg-no-repeat bg-[length:16px] bg-[right_0.75rem_center] pr-9 cursor-pointer`;
  const selectStyle: React.CSSProperties = {
    colorScheme: isDark ? "dark" : "light",
    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='${
      isDark ? "%23E5C24A" : "%23666"
    }' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")`,
  };
  const errCls = isDark ? "text-red-300" : "text-destructive";

  const busy = internalSubmitting || submitting;

  // Force every <select> inside the form to render as a single-line dropdown
  // (MP SDK occasionally sets size > 1, which renders an expanded listbox).
  // Also style browser autofill so it matches the dark theme instead of the
  // default white/blue Chrome highlight.
  useEffect(() => {
    if (!ready) return;
    const form = document.getElementById(formId);
    if (!form) return;
    form.querySelectorAll("select").forEach((el) => {
      el.setAttribute("size", "1");
      (el as HTMLSelectElement).size = 1;
    });
  }, [ready, formId]);

  const autofillStyle = isDark
    ? `
      #${formId} input:-webkit-autofill,
      #${formId} input:-webkit-autofill:hover,
      #${formId} input:-webkit-autofill:focus,
      #${formId} select:-webkit-autofill {
        -webkit-text-fill-color: #fff !important;
        -webkit-box-shadow: 0 0 0 1000px hsl(0 0% 8%) inset !important;
        caret-color: #fff !important;
        border-color: hsl(0 0% 100% / 0.15) !important;
        transition: background-color 9999s ease-in-out 0s;
      }
      #${formId} select { color-scheme: dark; }
      #${formId} select option {
        background-color: hsl(0 0% 8%);
        color: #fff;
      }
      #${formId} select option:checked,
      #${formId} select option:hover {
        background-color: hsl(var(--hero-gold)) !important;
        color: hsl(var(--hero-bg)) !important;
      }
    `
    : "";


  return (
    <form id={formId} className="space-y-4">
      {autofillStyle && <style>{autofillStyle}</style>}
      <div className="space-y-1.5">
        <label htmlFor={`${formId}-cardNumber`} className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>
          Número do cartão
        </label>
        <div id={`${formId}-cardNumber`} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-expirationDate`} className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>
            Validade
          </label>
          <div id={`${formId}-expirationDate`} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-securityCode`} className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>
            CVV
          </label>
          <div id={`${formId}-securityCode`} className={inputCls} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${formId}-cardholderName`} className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>
          Nome impresso no cartão
        </label>
        <input id={`${formId}-cardholderName`} type="text" className={inputCls} autoComplete="cc-name" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${formId}-cardholderEmail`} className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>
          E-mail
        </label>
        <input id={`${formId}-cardholderEmail`} type="email" className={inputCls} autoComplete="email" />
      </div>
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-identificationType`} className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>
            Tipo
          </label>
          <select id={`${formId}-identificationType`} className={selectCls} style={selectStyle} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${formId}-identificationNumber`} className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>
            CPF/CNPJ
          </label>
          <input id={`${formId}-identificationNumber`} type="text" className={inputCls} inputMode="numeric" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${formId}-issuer`} className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>
          Banco emissor
        </label>
        <StyledNativeSelect id={`${formId}-issuer`} isDark={isDark} placeholder="Selecione o banco" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${formId}-installments`} className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>
          Parcelas
        </label>
        <StyledNativeSelect id={`${formId}-installments`} isDark={isDark} placeholder="Selecione as parcelas" />
      </div>


      {(initError || errorMessage) && (
        <p className={`text-sm ${errCls}`}>{initError ?? errorMessage}</p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={!ready || busy}
        className="w-full text-base h-12 rounded-2xl font-extrabold uppercase tracking-wider"
        style={
          isDark
            ? { backgroundColor: "hsl(var(--hero-gold))", color: "hsl(var(--hero-bg))" }
            : undefined
        }
      >
        {busy ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando…</>
        ) : (
          <><CreditCard className="mr-2 h-4 w-4" /> Pagar R$ {amount.toFixed(2).replace(".", ",")}</>
        )}
      </Button>

      {!ready && !initError && (
        <p className={`text-xs ${isDark ? "text-white/60" : "text-muted-foreground"} text-center flex items-center gap-2 justify-center`}>
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando formulário seguro do Mercado Pago…
        </p>
      )}
    </form>
  );
}
