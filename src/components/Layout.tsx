import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Wrench, Building2, FileText, Clock,
  Receipt, Shield, DollarSign, Users, Menu, X, BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/equipamentos", icon: Wrench, label: "Equipamentos" },
  { to: "/empresas", icon: Building2, label: "Empresas" },
  { to: "/contratos", icon: FileText, label: "Contratos" },
  { to: "/medicoes", icon: Clock, label: "Medições" },
  { to: "/faturamento", icon: Receipt, label: "Faturamento" },
  { to: "/apolices", icon: Shield, label: "Apólices" },
  { to: "/gastos", icon: DollarSign, label: "Gastos" },
  { to: "/acompanhamento", icon: BarChart3, label: "Acompanhamento" },
  { to: "/usuarios", icon: Users, label: "Usuários" },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar flex flex-col transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Wrench className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-base text-sidebar-accent-foreground">LocaGest</h1>
              <p className="text-[11px] text-sidebar-foreground/50 tracking-wide uppercase">Gestão de Locações</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-sidebar-border">
          <p className="text-[10px] text-sidebar-foreground/30 text-center">LocaGest v1.0</p>
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
          <div className="lg:hidden font-semibold text-sm text-foreground">LocaGest</div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
};
