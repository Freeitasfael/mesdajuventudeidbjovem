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
  LogIn,
  LayoutDashboard,
  Menu,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { to: "/rifa", label: "Início", icon: Home },
  { to: "/rifa#rifa-grid", label: "Comprar números", icon: Ticket },
  { to: "/acompanhar", label: "Consultar número", icon: Search },
  { to: "/afiliacao", label: "Quero me afiliar", icon: Handshake },
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
          (item.to !== "/rifa" && location.pathname.startsWith(item.to)));
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
      <div className="container flex items-center justify-between gap-3 py-3">
        <Link
          to="/rifa"
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
          <Button
            asChild
            size="sm"
            className="rounded-full font-bold"
            style={{
              backgroundColor: "hsl(var(--hero-gold))",
              color: "hsl(var(--hero-bg))",
            }}
          >
            <Link to={accountTarget}>
              <AccountIcon className="mr-1.5 h-4 w-4" />
              {accountLabel}
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
            <SheetContent side="right" className="w-[280px] bg-card text-foreground">
              <div className="mt-8 flex flex-col gap-1">{renderLinks(undefined, true)}</div>
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
