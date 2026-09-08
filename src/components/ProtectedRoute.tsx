import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

interface Props {
  children: React.ReactNode;
  requiredPermission?: string;
}

export const ProtectedRoute = ({ children, requiredPermission }: Props) => {
  const { user, loading, permissions, role, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user || !profile) return <Navigate to="/login" replace />;
  if (profile.status !== "Ativo") return <Navigate to="/login" replace />;

  // Admin and Master have access to everything
  if (role === "admin" || role === "master") return <>{children}</>;

  // Check specific permission
  const hasPermission = requiredPermission
    ? (requiredPermission === "/controladoria"
      ? (permissions.includes("/controladoria") || permissions.includes("/acompanhamento"))
      : permissions.includes(requiredPermission))
    : true;

  if (requiredPermission && !hasPermission) {
    const allowedRoutes = [
      "/equipamentos",
      "/empresas",
      "/contratos",
      "/propostas",
      "/medicoes",
      "/faturamento",
      "/apolices",
      "/gastos",
      "/controladoria",
      "/agenda"
    ];
    const firstAllowed = allowedRoutes.find(r => 
      r === "/controladoria" 
        ? (permissions.includes("/controladoria") || permissions.includes("/acompanhamento")) 
        : permissions.includes(r)
    );

    if (firstAllowed) {
      return <Navigate to={firstAllowed} replace />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
