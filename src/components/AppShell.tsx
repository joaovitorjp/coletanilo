import { Link, useLocation } from "@tanstack/react-router";
import { History, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const { pathname } = useLocation();
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 px-5 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}>
            <ScanLine className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">{title ?? "Coletor"}</h1>
            <p className="text-xs text-muted-foreground">Coleta de produtos</p>
          </div>
        </div>
      </header>
      <main className="flex-1 px-5 py-5 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-1/2 z-10 w-full max-w-md -translate-x-1/2 border-t border-border/60 bg-background/90 backdrop-blur-md">
        <div className="grid grid-cols-2">
          <NavItem to="/" active={pathname === "/"} icon={<ScanLine className="h-5 w-5" />} label="Nova Coleta" />
          <NavItem to="/historico" active={pathname.startsWith("/historico")} icon={<History className="h-5 w-5" />} label="Histórico" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ to, active, icon, label }: { to: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className={cn("flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors", active ? "text-primary" : "text-muted-foreground")}>
      {icon}
      {label}
    </Link>
  );
}
