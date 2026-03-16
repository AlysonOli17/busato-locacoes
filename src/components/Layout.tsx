import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Wrench, Building2, FileText, Clock,
  Receipt, Shield, DollarSign, Users, Menu, X, BarChart3, LogOut,
  PanelLeftClose, PanelLeftOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import logoBusato from "@/assets/logo-busato.png";

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

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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
          collapsed ? "lg:w-16 w-64" : "w-64",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex flex-col items-center gap-1">
              <img src={logoBusato} alt="Busato" className="h-9" />
              <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-sidebar-foreground/70" style={{ fontFamily: "'Oswald', sans-serif" }}>Locações</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-sidebar-border">
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
          <div className="flex-1" />
          <NotificationsDropdown />
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};
