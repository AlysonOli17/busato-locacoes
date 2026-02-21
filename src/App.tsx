import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Equipamentos from "./pages/Equipamentos";
import Empresas from "./pages/Empresas";
import Contratos from "./pages/Contratos";
import Medicoes from "./pages/Medicoes";
import Faturamento from "./pages/Faturamento";
import Apolices from "./pages/Apolices";
import Gastos from "./pages/Gastos";
import Usuarios from "./pages/Usuarios";
import Acompanhamento from "./pages/Acompanhamento";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute requiredPermission="/equipamentos"><Equipamentos /></ProtectedRoute>} />
            <Route path="/equipamentos" element={<ProtectedRoute requiredPermission="/equipamentos"><Equipamentos /></ProtectedRoute>} />
            <Route path="/empresas" element={<ProtectedRoute requiredPermission="/empresas"><Empresas /></ProtectedRoute>} />
            <Route path="/contratos" element={<ProtectedRoute requiredPermission="/contratos"><Contratos /></ProtectedRoute>} />
            <Route path="/medicoes" element={<ProtectedRoute requiredPermission="/medicoes"><Medicoes /></ProtectedRoute>} />
            <Route path="/faturamento" element={<ProtectedRoute requiredPermission="/faturamento"><Faturamento /></ProtectedRoute>} />
            <Route path="/apolices" element={<ProtectedRoute requiredPermission="/apolices"><Apolices /></ProtectedRoute>} />
            <Route path="/gastos" element={<ProtectedRoute requiredPermission="/gastos"><Gastos /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute requiredPermission="/usuarios"><Usuarios /></ProtectedRoute>} />
            <Route path="/acompanhamento" element={<ProtectedRoute requiredPermission="/acompanhamento"><Acompanhamento /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
