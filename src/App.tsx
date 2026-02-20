import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Equipamentos from "./pages/Equipamentos";
import Empresas from "./pages/Empresas";
import Contratos from "./pages/Contratos";
import Medicoes from "./pages/Medicoes";
import Faturamento from "./pages/Faturamento";
import Apolices from "./pages/Apolices";
import Gastos from "./pages/Gastos";
import Usuarios from "./pages/Usuarios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/equipamentos" element={<Equipamentos />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/contratos" element={<Contratos />} />
          <Route path="/medicoes" element={<Medicoes />} />
          <Route path="/faturamento" element={<Faturamento />} />
          <Route path="/apolices" element={<Apolices />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
