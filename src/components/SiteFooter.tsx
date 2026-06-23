import { Link } from "react-router-dom";
import { Instagram, Youtube, MessageCircle } from "lucide-react";
import logoIdb from "@/assets/idb-jovem-logo.png";

export const SiteFooter = () => {
  return (
    <footer
      className="border-t"
      style={{
        backgroundColor: "hsl(var(--hero-bg-deep))",
        borderColor: "hsl(var(--hero-gold) / 0.15)",
      }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <img src={logoIdb} alt="IDB Jovem" loading="lazy" decoding="async" className="h-12 w-auto" />
            <div>
              <p className="font-extrabold uppercase tracking-wider text-white">
                IDB Jovem
              </p>
              <p className="text-xs text-white/60">
                Mês da Juventude · Jesus Transforma
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-md text-sm text-white/70">
            Há 16 anos percorrendo o Brasil com uma só mensagem que
            transforma. Junte-se à maior celebração jovem do país.
          </p>
          <div className="mt-5 flex items-center gap-3">
            {[
              { href: "https://instagram.com/idbjovemminas", label: "Instagram @idbjovemminas", Icon: Instagram },
              { href: "https://youtube.com", label: "YouTube", Icon: Youtube },
              { href: "https://wa.me/", label: "WhatsApp", Icon: MessageCircle },
            ].map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border transition hover:scale-110"
                style={{
                  borderColor: "hsl(var(--hero-gold) / 0.35)",
                  color: "hsl(var(--hero-gold))",
                }}
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-white/90">
            Participe
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li><Link to="/inscricao" className="hover:text-white">Inscrição</Link></li>
            <li><Link to="/rifa" className="hover:text-white">Rifa oficial</Link></li>
            <li><Link to="/camiseta" className="hover:text-white">Camiseta oficial</Link></li>
            <li><Link to="/afiliacao" className="hover:text-white">Quero me afiliar</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-white/90">
            Conta & suporte
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li><Link to="/acompanhar" className="hover:text-white">Consultar número</Link></li>
            <li><Link to="/auth" className="hover:text-white">Minha área</Link></li>
            <li><a href="mailto:contato@idbjovem.com" className="hover:text-white">Fale conosco</a></li>
          </ul>
        </div>
      </div>

      <div
        className="border-t"
        style={{ borderColor: "hsl(var(--hero-gold) / 0.12)" }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-white/55 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} IDB Jovem — Todos os direitos reservados.</p>
          <p>Feito com fé e propósito.</p>
        </div>
      </div>
    </footer>
  );
};
