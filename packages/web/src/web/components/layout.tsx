import { Link, useLocation } from "wouter";
import {
  Cpu,
  GaugeCircle,
  History,
  LayoutDashboard,
  LogOut,
  ScanLine,
  Settings,
  Users,
} from "lucide-react";
import { authClient } from "../lib/auth";
import { useMe } from "../queries/admin";

const NAV = [
  { to: "/", label: "Panel", icon: LayoutDashboard },
  { to: "/escaneo", label: "Nuevo escaneo", icon: ScanLine },
  { to: "/pacientes", label: "Pacientes", icon: Users },
  { to: "/historial", label: "Historial", icon: History },
  { to: "/fiabilidad", label: "Fiabilidad", icon: GaugeCircle },
  { to: "/dispositivos", label: "Dispositivos", icon: Cpu },
  { to: "/admin", label: "Administración", icon: Settings, adminOnly: true },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const me = useMe();
  const isAdmin = me.data?.role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="logo-icon">DET</span>
            <span className="flex flex-col leading-tight">
              <span className="logo-title">DET-Cut IA</span>
              <span className="logo-sub">Panel de Diagnóstico</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="status-badge hidden sm:flex">
              <span className="status-dot" />
              Motor operativo
            </span>
            <span className="user-chip hidden sm:flex">
              <span className="user-avatar">{(me.data?.name ?? me.data?.email ?? "?").charAt(0).toUpperCase()}</span>
              <span className="max-w-[150px] truncate">{me.data?.name ?? me.data?.email ?? "—"}</span>
              <span className="mono text-[9px] uppercase tracking-wide text-muted-foreground">
                {isAdmin ? "Admin" : "Médico"}
              </span>
            </span>
            <button
              type="button"
              className="btn-logout"
              title="Cerrar sesión"
              onClick={async () => {
                await authClient.signOut();
                window.location.href = "/login";
              }}
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 py-6 md:px-6">
        <aside className="no-print hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-1">
            {NAV.filter((n) => !n.adminOnly || isAdmin).map((item) => {
              const active = item.to === "/" ? location === "/" : location.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-primary text-white"
                      : "text-foreground/80 hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Navegación móvil */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-surface px-1 py-1.5 lg:hidden">
        {NAV.filter((n) => !n.adminOnly || isAdmin)
          .slice(0, 5)
          .map((item) => {
            const active = item.to === "/" ? location === "/" : location.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
      </nav>
      <div className="h-14 lg:hidden" />
    </div>
  );
}
