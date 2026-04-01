import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Wrench, Building2, FileText, Clock, CalendarDays,
  Receipt, Shield, DollarSign, Users, Menu, X, BarChart3, LogOut,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import logoBusato from "@/assets/logo-busato.png";
import globoBusato from "@/assets/globo-busato.png";

const allNavItems = [
  { to: "/equipamentos", icon: Wrench, label: "Equipamentos" },
  { to: "/empresas", icon: Building2, label: "Empresas" },
  { to: "/contratos", icon: FileText, label: "Contratos" },
  
  { to: "/medicoes", icon: Clock, label: "Medições / Faturamento" },
  { to: "/apolices", icon: Shield, label: "Apólices" },
  { to: "/gastos", icon: DollarSign, label: "Custos" },
  { to: "/acompanhamento", icon: BarChart3, label: "Acompanhamento" },
  { to: "/usuarios", icon: Users, label: "Usuários", adminOnly: true },
];

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const Layout = ({ children, title, subtitle }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const { role, permissions, signOut, profile } = useAuth();

  const navItems = allNavItems.filter(item => {
    if (role === "admin") return true;
    if (item.adminOnly) return false;
    return permissions.includes(item.to);
  });

  return (
    <div className="flex h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 bg-sidebar flex flex-col transition-all duration-300 ease-in-out",
          collapsed ? "lg:w-[68px] w-64" : "w-64",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center border-b border-sidebar-border transition-all duration-300",
          collapsed ? "justify-center px-2 py-4" : "justify-center px-5 py-5"
        )}>
          {collapsed ? (
            <img src={globoBusato} alt="Busato" className="h-9 w-9 object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <img src={logoBusato} alt="Busato" className="h-9" />
              <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-sidebar-foreground/70" style={{ fontFamily: "'Oswald', sans-serif" }}>Locações</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-sidebar-foreground absolute right-3 top-5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto scrollbar-thin", collapsed ? "px-1.5" : "px-3")}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={cn("py-3 border-t border-sidebar-border", collapsed ? "px-1.5" : "px-3")}>
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{profile?.nome}</p>
                <p className="text-[10px] text-sidebar-foreground/50 truncate">{role === "admin" ? "Administrador" : role === "operador" ? "Operador" : "Visualizador"}</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            title={collapsed ? "Sair" : undefined}
            className={cn(
              "w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
              collapsed ? "justify-center px-0" : "justify-start"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>

        {/* Collapse toggle - bottom chevron */}
        <button
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            localStorage.setItem("sidebar-collapsed", String(next));
          }}
          className="hidden lg:flex items-center justify-center py-2 border-t border-sidebar-border text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-colors"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-foreground hover:text-accent transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden font-semibold text-sm text-foreground">Busato Locações</div>
          {title && (
            <div className="hidden lg:block min-w-0">
              <h1 className="text-lg font-bold text-foreground leading-tight truncate">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground leading-tight truncate">{subtitle}</p>}
            </div>
          )}
          <div className="flex-1" />
          <NotificationsDropdown />
        </header>

        <main className="flex-1 overflow-y-auto p-3 md:p-4 scrollbar-thin">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};
