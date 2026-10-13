import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy Loaded Pages
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const Equipamentos = React.lazy(() => import("./pages/Equipamentos"));
const Empresas = React.lazy(() => import("./pages/Empresas"));
const Contratos = React.lazy(() => import("./pages/Contratos"));
const Medicoes = React.lazy(() => import("./pages/Medicoes"));
const Faturamento = React.lazy(() => import("./pages/Faturamento"));
const Apolices = React.lazy(() => import("./pages/Apolices"));
const Usuarios = React.lazy(() => import("./pages/Usuarios"));
const Controladoria = React.lazy(() => import("./pages/Controladoria"));
const Agregados = React.lazy(() => import("./pages/Agregados"));
const Login = React.lazy(() => import("./pages/Login"));
const Agenda = React.lazy(() => import("./pages/Agenda"));
const Configuracoes = React.lazy(() => import("./pages/Configuracoes"));
const ManualPage = React.lazy(() => import("./pages/Manual"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const VistoriaPublica = React.lazy(() => import("./pages/VistoriaPublica"));
const Vales = React.lazy(() => import("./pages/Vales"));
const Relequip = React.lazy(() => import("./pages/Relequip"));

// Fallback de carregamento visualmente agradável
const PageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background">
    <Loader2 className="w-10 h-10 text-primary animate-spin" />
    <p className="mt-4 text-sm text-muted-foreground font-medium animate-pulse">Carregando módulo...</p>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Rota pública sem autenticação */}
              <Route path="/vistoria/:token" element={<VistoriaPublica />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/equipamentos" element={<ProtectedRoute requiredPermission="/equipamentos"><Equipamentos /></ProtectedRoute>} />
              <Route path="/relequip" element={<ProtectedRoute requiredPermission="/relequip"><Relequip /></ProtectedRoute>} />
              <Route path="/empresas" element={<ProtectedRoute requiredPermission="/empresas"><Empresas /></ProtectedRoute>} />
              <Route path="/contratos" element={<ProtectedRoute requiredPermission="/contratos"><Contratos /></ProtectedRoute>} />
              <Route path="/propostas" element={<Navigate to="/contratos" replace />} />
              <Route path="/medicoes" element={<ProtectedRoute requiredPermission="/medicoes"><Medicoes /></ProtectedRoute>} />
              <Route path="/faturamento" element={<Navigate to="/medicoes" replace />} />
              <Route path="/apolices" element={<ProtectedRoute requiredPermission="/apolices"><Apolices /></ProtectedRoute>} />
              <Route path="/usuarios" element={<ProtectedRoute requiredPermission="/usuarios"><Usuarios /></ProtectedRoute>} />
              <Route path="/vales" element={<ProtectedRoute requiredPermission="/vales"><Vales /></ProtectedRoute>} />
              <Route path="/controladoria" element={<ProtectedRoute requiredPermission="/controladoria"><Controladoria /></ProtectedRoute>} />
              <Route path="/acompanhamento" element={<Navigate to="/controladoria" replace />} />
              <Route path="/agregados" element={<ProtectedRoute requiredPermission="/agregados"><Agregados /></ProtectedRoute>} />
              <Route path="/agenda" element={<ProtectedRoute requiredPermission="/agenda"><Agenda /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="/manual" element={<ManualPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
