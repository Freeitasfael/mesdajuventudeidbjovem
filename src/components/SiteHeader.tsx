import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import logoIdb from "@/assets/idb-jovem-logo.png";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Home,
  Ticket,
  Search,
  Handshake,
  Sparkles,
  LogIn,
  LayoutDashboard,
  Menu,
  UserPlus,
  Shirt,
  Instagram,
} from "lucide-react";

const INSTAGRAM_URL = "https://instagram.com/idbjovemminas";
const INSTAGRAM_HANDLE = "@idbjovemminas";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { to: "/", label: "Início", icon: Home },
  { to: "/inscricao", label: "Inscrição", icon: UserPlus },
  { to: "/rifa", label: "Rifa", icon: Ticket },
  { to: "/camiseta", label: "Camiseta", icon: Shirt },
  { to: "/acompanhar", label: "Consultar número", icon: Search },
  { to: "/afiliacao", label: "Afiliados", icon: Handshake },
];

interface Props {
  /** When true, header uses the dark hero palette (transparent over hero bg). */
  variant?: "dark" | "light";
  /** Optional breadcrumb segments (rendered below the bar). */
  breadcrumbs?: { label: string; to?: string }[];
}

export const SiteHeader = ({ variant = "light", breadcrumbs }: Props) => {
  const location = useLocation();
  const [authed, setAuthed] = useState(false);
  const [accountTarget, setAccountTarget] = useState<string>("/auth");

  useEffect(() => {
    const resolve = async (uid?: string) => {
      if (!uid) {
        setAuthed(false);
        setAccountTarget("/auth");
        return;
      }
      setAuthed(true);
      // Decide where the "Minha área" link should go
      const [{ data: roleRow }, { data: sellerRow }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .eq("role", "admin")
          .maybeSingle(),
        supabase.rpc("get_my_seller").maybeSingle(),
      ]);
      if (roleRow) setAccountTarget("/admin");
      else if (sellerRow) setAccountTarget("/seller");
      else setAccountTarget("/afiliacao");
    };

    supabase.auth.getSession().then(({ data }) => resolve(data.session?.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      resolve(s?.user?.id),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const isDark = variant === "dark";
  const containerCls = isDark
    ? "border-b border-white/10 bg-black/60 backdrop-blur-md"
    : "border-b border-border bg-card/80 backdrop-blur-md";
  const linkBase = isDark
    ? "text-white/75 hover:text-white"
    : "text-muted-foreground hover:text-foreground";
  const linkActive = isDark ? "text-white" : "text-foreground";

  const renderLinks = (onClick?: () => void, forceLight = false) => {
    const lBase = forceLight
      ? "text-muted-foreground hover:text-foreground"
      : linkBase;
    const lActive = forceLight ? "text-foreground" : linkActive;
    const activeBg = forceLight
      ? "bg-muted"
      : isDark
      ? "bg-white/10"
      : "bg-muted";
    return NAV.map((item) => {
      const isHash = item.to.includes("#");
      const active =
        !isHash &&
        (location.pathname === item.to ||
          (item.to !== "/" && item.to !== "/rifa" && location.pathname.startsWith(item.to))) ||
        (item.to === "/rifa" && location.pathname === "/rifa");
      const Icon = item.icon;
      const cls = `inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
        active ? `${lActive} ${activeBg}` : lBase
      }`;
      if (isHash) {
        return (
          <a key={item.to} href={item.to} className={cls} onClick={onClick}>
            <Icon className="h-4 w-4" />
            {item.label}
          </a>
        );
      }
      return (
        <NavLink key={item.to} to={item.to} className={cls} onClick={onClick}>
          <Icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      );
    });
  };

  const accountLabel = authed ? "Minha área" : "Login";
  const AccountIcon = authed ? LayoutDashboard : LogIn;

  return (
    <header className={`sticky top-0 z-40 w-full ${containerCls}`}>
      <div className="container flex items-center justify-between gap-2 py-3 sm:gap-3">
        <Link
          to="/"
          className={`flex items-center gap-2.5 font-extrabold tracking-tight ${
            isDark ? "text-white" : "text-foreground"
          }`}
        >
          <img
            src={logoIdb}
            alt="IDB Jovem"
            className="h-9 w-auto sm:h-10"
            style={{
              backgroundColor: "transparent",
              filter: "drop-shadow(0 2px 6px hsl(var(--hero-gold) / 0.35))",
            }}
          />
          <span className="hidden text-base sm:inline sm:text-lg">
            RIFA IDB JOVEM
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">{renderLinks()}</nav>

        <div className="flex items-center gap-2">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={`Instagram ${INSTAGRAM_HANDLE}`}
            title={INSTAGRAM_HANDLE}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition hover:scale-[1.03] sm:px-3 sm:text-sm ${
              isDark
                ? "border-white/25 bg-white/5 text-white hover:bg-white/10"
                : "border-border bg-background text-foreground hover:bg-muted"
            }`}
            style={{ color: "hsl(var(--hero-gold))", borderColor: "hsl(var(--hero-gold) / 0.4)" }}
          >
            <Instagram className="h-4 w-4" />
            <span className="hidden sm:inline">{INSTAGRAM_HANDLE}</span>
          </a>

          <Button
            asChild
            size="sm"
            className="rounded-full font-bold px-3 sm:px-4"
            style={{
              backgroundColor: "hsl(var(--hero-gold))",
              color: "hsl(var(--hero-bg))",
            }}
          >
            <Link to={accountTarget} aria-label={accountLabel}>
              <AccountIcon className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{accountLabel}</span>
            </Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant={isDark ? "outline" : "ghost"}
                className={`lg:hidden ${
                  isDark ? "border-white/30 bg-white/5 text-white" : ""
                }`}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-[320px] bg-card text-foreground p-5 sm:p-6">
              <div className="mt-8 flex flex-col gap-1">{renderLinks(undefined, true)}</div>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
                style={{
                  color: "hsl(var(--hero-gold))",
                  borderColor: "hsl(var(--hero-gold) / 0.4)",
                }}
              >
                <Instagram className="h-4 w-4" />
                {INSTAGRAM_HANDLE}
              </a>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {breadcrumbs && breadcrumbs.length > 0 && (
        <div
          className={`border-t ${
            isDark ? "border-white/10" : "border-border"
          }`}
        >
          <nav
            aria-label="breadcrumb"
            className={`container py-2 text-xs ${
              isDark ? "text-white/60" : "text-muted-foreground"
            }`}
          >
            <ol className="flex flex-wrap items-center gap-1.5">
              {breadcrumbs.map((b, i) => {
                const last = i === breadcrumbs.length - 1;
                return (
                  <li key={i} className="inline-flex items-center gap-1.5">
                    {b.to && !last ? (
                      <Link to={b.to} className="hover:underline">
                        {b.label}
                      </Link>
                    ) : (
                      <span
                        className={
                          last ? (isDark ? "text-white" : "text-foreground") : ""
                        }
                      >
                        {b.label}
                      </span>
                    )}
                    {!last && <span aria-hidden>/</span>}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      )}
    </header>
  );
};
