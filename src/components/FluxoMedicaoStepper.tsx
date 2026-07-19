import { cn } from "@/lib/utils";
import {
  ClipboardList,
  ShieldCheck,
  DollarSign,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

interface StepInfo {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  tab: string;
  color: string;
  badgeColor: string;
  alert?: boolean;
}

interface FluxoMedicaoStepperProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  contadores?: {
    pendencias?: number;
    emitir?: number;
    aguardandoAprovacao?: number;
    faturar?: number;
  };
}

const STEPS: StepInfo[] = [
  {
    id: "pendencias",
    label: "Pendências",
    sublabel: "Alertas em aberto",
    icon: AlertTriangle,
    tab: "pendencias",
    color: "text-destructive",
    badgeColor: "bg-destructive/10 text-destructive border-destructive/30",
    alert: true,
  },
  {
    id: "emitir-medicao",
    label: "Emitir Medição",
    sublabel: "Criar e salvar a cobrança",
    icon: ClipboardList,
    tab: "emitir-medicao",
    color: "text-primary",
    badgeColor: "bg-primary/10 text-primary border-primary/30",
  },
  {
    id: "aprovar",
    label: "Aguard. Cliente",
    sublabel: "Enviado, aguardando confirmação",
    icon: ShieldCheck,
    tab: "aprovar",
    color: "text-warning",
    badgeColor: "bg-warning/10 text-warning border-warning/30",
  },
  {
    id: "faturar",
    label: "Faturar",
    sublabel: "Cliente aprovou → emitir NF",
    icon: DollarSign,
    tab: "faturar",
    color: "text-accent",
    badgeColor: "bg-accent/10 text-accent border-accent/30",
  },
  {
    id: "historico",
    label: "Histórico",
    sublabel: "Faturas pagas / encerradas",
    icon: CheckCircle2,
    tab: "historico",
    color: "text-success",
    badgeColor: "bg-success/10 text-success border-success/30",
  },
];

export function FluxoMedicaoStepper({
  activeTab,
  onTabChange,
  contadores = {},
}: FluxoMedicaoStepperProps) {
  const countForStep = (id: string) => {
    switch (id) {
      case "pendencias": return contadores.pendencias;
      case "emitir-medicao": return contadores.emitir;
      case "aprovar": return contadores.aguardandoAprovacao;
      case "faturar": return contadores.faturar;
      default: return undefined;
    }
  };

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border bg-muted/30">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Fluxo de Medição &amp; Faturamento
        </p>
      </div>

      {/* Steps row */}
      <div className="flex items-stretch overflow-x-auto">
        {STEPS.map((step, index) => {
          const isActive = activeTab === step.tab;
          const Icon = step.icon;
          const count = countForStep(step.id);
          const hasAlert = step.alert && count && count > 0;

          return (
            <div key={step.id} className="flex items-stretch flex-1 min-w-[110px]">
              <button
                onClick={() => onTabChange(step.tab)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 px-2 text-center transition-all duration-200 relative group cursor-pointer",
                  "hover:bg-muted/40",
                  isActive
                    ? "bg-muted/50 border-b-2 border-accent"
                    : "border-b-2 border-transparent"
                )}
              >
                {/* Icon with counter badge */}
                <div className="relative">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center transition-all duration-200",
                      isActive
                        ? `${step.badgeColor} shadow-sm`
                        : "bg-muted/60 text-muted-foreground group-hover:bg-muted"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive && step.color)} />
                  </div>
                  {count !== undefined && count > 0 && (
                    <span
                      className={cn(
                        "absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 border",
                        hasAlert
                          ? "bg-destructive text-destructive-foreground border-destructive animate-pulse"
                          : "bg-warning text-warning-foreground border-warning"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </div>

                {/* Label */}
                <div>
                  <p
                    className={cn(
                      "text-[11px] font-semibold leading-tight",
                      isActive ? step.color : "text-foreground/70 group-hover:text-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 hidden sm:block">
                    {step.sublabel}
                  </p>
                </div>
              </button>

              {/* Separator arrow */}
              {index < STEPS.length - 1 && (
                <div className="flex items-center self-center text-muted-foreground/30 shrink-0">
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
