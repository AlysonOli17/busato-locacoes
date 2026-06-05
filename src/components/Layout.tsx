import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Wrench, Building2, FileText, Clock, CalendarDays,
  Receipt, Shield, DollarSign, Users, Menu, X, BarChart3, LogOut,
  ChevronLeft, ChevronRight, ClipboardCheck, Calendar, ChevronDown, Folder, FileSignature, AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { NotificationsDropdown, NotificationToastContainer } from "@/components/NotificationsDropdown";
import logoBusato from "@/assets/logo-busato.png";
import globoBusato from "@/assets/globo-busato.png";

interface SubNavItem {
  to: string;
  label: string;
  icon: any;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  icon: any;
  items?: SubNavItem[];
  to?: string;
  adminOnly?: boolean;
}

const allGroups: NavGroup[] = [
  {
    label: "Agenda & Kanban",
    icon: Calendar,
    to: "/agenda"
  },
  {
    label: "Controladoria",
    icon: BarChart3,
    to: "/controladoria"
  },
  {
    label: "Cadastros",
    icon: Building2,
    items: [
      { to: "/equipamentos", icon: Wrench, label: "Equipamentos" },
      { to: "/empresas", icon: Building2, label: "Empresas" },
    ]
  },
  {
    label: "Contratos",
    icon: FileText,
    items: [
      { to: "/contratos?tab=contratos", icon: FileText, label: "Contratos" },
      { to: "/contratos?tab=propostas", icon: FileSignature, label: "Propostas" },
      { to: "/contratos?tab=modelo", icon: BookOpen, label: "Modelo de Contrato" },
    ]
  },
  {
    label: "Seguros",
    icon: Shield,
    items: [
      { to: "/apolices?tab=apolices", icon: Shield, label: "Apólices" },
      { to: "/apolices?tab=sinistro", icon: AlertCircle, label: "Sinistros" },
    ]
  },
  {
    label: "Locação Terceiros",
    icon: CalendarDays,
    items: [
      { to: "/agregados?tab=fornecedores", icon: Building2, label: "Fornecedores" },
      { to: "/agregados?tab=equipamentos", icon: Wrench, label: "Equipamentos" },
      { to: "/agregados?tab=contratos", icon: FileText, label: "Contratos" },
      { to: "/agregados?tab=horimetro", icon: Clock, label: "Lançamento" },
      { to: "/agregados?tab=medicao", icon: Receipt, label: "Medição" },
      { to: "/agregados?tab=custos", icon: DollarSign, label: "Custos" },
    ]
  },
  {
    label: "Medições",
    icon: Clock,
    items: [
      { to: "/medicoes?tab=medicoes", icon: Clock, label: "Horímetro" },
      { to: "/medicoes?tab=faturamento", icon: Receipt, label: "Emitir medição" },
      { to: "/medicoes?tab=pendentes-medicao", icon: AlertCircle, label: "Pendente de Medição" },
    ]
  },
  {
    label: "Financeiro & Custos",
    icon: DollarSign,
    items: [
      { to: "/medicoes?tab=faturamento-novo", icon: DollarSign, label: "Emissão de faturas" },
      { to: "/medicoes?tab=historico-faturamento", icon: Receipt, label: "Histórico Financeiro" },
      { to: "/gastos", icon: DollarSign, label: "Custos" },
    ]
  },
  {
    label: "Gestão",
    icon: Users,
    items: [
      { to: "/usuarios", icon: Users, label: "Usuários", adminOnly: true },
    ]
  }
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
  const location = useLocation();

  // Expanded groups state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("sidebar-expanded-groups");
    return saved ? JSON.parse(saved) : {
      "Cadastros": true,
      "Contratos & Seguros": true,
      "Medições": true,
      "Financeiro & Custos": true,
      "Gestão & Agenda": true,
    };
  });

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(prev => {
      const next = { ...prev, [groupLabel]: !prev[groupLabel] };
      localStorage.setItem("sidebar-expanded-groups", JSON.stringify(next));
      return next;
    });
  };

  // Preserve sidebar scroll position
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    sessionStorage.setItem("sidebar-scroll-position", String(e.currentTarget.scrollTop));
  };

  useEffect(() => {
    const navElement = document.getElementById("sidebar-nav");
    if (navElement) {
      const saved = sessionStorage.getItem("sidebar-scroll-position");
      if (saved) {
        navElement.scrollTop = parseFloat(saved);
      }
    }
  }, [location.pathname, location.search]);

  // Helper to determine if a specific sub-item is active
  const isItemActive = (to: string) => {
    const [itemPath, itemQuery] = to.split('?');
    const itemTab = itemQuery ? new URLSearchParams(itemQuery).get('tab') : null;

    const currentPath = location.pathname;
    const currentTab = new URLSearchParams(location.search).get("tab");

    if (currentPath !== itemPath) return false;
    if (itemTab && currentTab !== itemTab) return false;
    return true;
  };

  // Helper to determine if any item in a group is active
  const isGroupActive = (group: NavGroup) => {
    if (group.to) return isItemActive(group.to);
    return !!(group.items && group.items.some(item => isItemActive(item.to)));
  };

  // Auto-expand active group on mount or route change
  useEffect(() => {
    const activeGroup = allGroups.find(g => isGroupActive(g));
    if (activeGroup) {
      setExpandedGroups(prev => {
        if (prev[activeGroup.label]) return prev;
        const next = { ...prev, [activeGroup.label]: true };
        localStorage.setItem("sidebar-expanded-groups", JSON.stringify(next));
        return next;
      });
    }
  }, [location.pathname, location.search]);

  // Filter groups and items based on permissions
  const filteredGroups = allGroups.map(group => {
    if (group.to) {
      const pathname = group.to.split('?')[0];
      const hasPermission = role === "admin" || (permissions || []).includes(pathname);
      if (!hasPermission) return null;
      return group;
    }
    const items = (group.items || []).filter(item => {
      if (role === "admin") return true;
      if (item.adminOnly) return false;
      
      const pathname = item.to.split('?')[0];
      return (permissions || []).includes(pathname);
    });
    return { ...group, items };
  }).filter((group): group is NavGroup => {
    if (!group) return false;
    if (role !== "admin" && group.adminOnly) return false;
    if (group.to) return true;
    return !!(group.items && group.items.length > 0);
  });

  return (
    <>
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
        <nav id="sidebar-nav" onScroll={handleScroll} className={cn("flex-1 py-4 space-y-3 overflow-y-auto scrollbar-thin", collapsed ? "px-1.5" : "px-3")}>
          {filteredGroups.map((group) => {
            const hasActiveItem = isGroupActive(group);
            const isExpanded = !!expandedGroups[group.label];

            if (group.to) {
              if (collapsed) {
                return (
                  <NavLink
                    key={group.to}
                    to={group.to}
                    onClick={() => setSidebarOpen(false)}
                    title={group.label}
                    className={cn(
                      "flex items-center justify-center p-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      hasActiveItem
                        ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <group.icon className="h-[18px] w-[18px] shrink-0" />
                  </NavLink>
                );
              }

              return (
                <NavLink
                  key={group.to}
                  to={group.to}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-[0.12em] transition-all duration-200",
                    hasActiveItem
                      ? "bg-sidebar-accent/60 text-sidebar-primary font-bold"
                      : "text-sidebar-foreground/45 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <group.icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span>{group.label}</span>
                  </div>
                </NavLink>
              );
            }

            if (collapsed) {
              // Collapsed mode: render flat list of sub-items
              return (
                <div key={group.label} className="space-y-1">
                  {(group.items || []).map((item) => {
                    const active = isItemActive(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setSidebarOpen(false)}
                        title={item.label}
                        className={cn(
                          "flex items-center justify-center p-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                      </NavLink>
                    );
                  })}
                </div>
              );
            }

            // Expanded mode: Folder structure
            return (
              <div key={group.label} className="space-y-1.5">
                {/* Group Folder Header */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-[0.12em] transition-all duration-200",
                    hasActiveItem
                      ? "text-sidebar-foreground/80 font-bold"
                      : "text-sidebar-foreground/45 hover:text-sidebar-foreground/80 hover:bg-sidebar-accent/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <group.icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span>{group.label}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform duration-200 shrink-0 opacity-50",
                      isExpanded ? "transform rotate-0" : "transform -rotate-90"
                    )}
                  />
                </button>

                {/* Sub items */}
                {isExpanded && (
                  <div className="pl-3 ml-3 border-l border-sidebar-border/30 space-y-1 animate-fade-in">
                    {(group.items || []).map((item) => {
                      const active = isItemActive(item.to);
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 relative",
                            active
                              ? "bg-sidebar-accent/60 text-sidebar-primary shadow-sm font-semibold border-l-2 border-sidebar-primary pl-[8px]"
                              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground pl-2.5"
                          )}
                        >
                          <item.icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
    <NotificationToastContainer />
    </>
  );
};
