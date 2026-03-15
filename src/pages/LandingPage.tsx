import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wrench, FileText, BarChart3, Shield, ArrowRight } from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/images/logo-busato-horizontal.png"
              alt="Busato Locações"
              className="h-9 object-contain"
            />
          </div>
          <Button onClick={() => navigate("/login")} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Acessar Sistema
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight tracking-tight">
            Gestão Inteligente de{" "}
            <span className="text-primary">Locações</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Controle completo de equipamentos, contratos, medições e faturamento em uma única plataforma.
          </p>
          <div className="pt-4">
            <Button
              size="lg"
              onClick={() => navigate("/login")}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-base px-8 py-6 h-auto"
            >
              Entrar no Sistema
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-12">
            Tudo o que você precisa para gerenciar suas locações
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: Wrench, title: "Equipamentos", desc: "Cadastro e controle completo do seu patrimônio de máquinas." },
              { icon: FileText, title: "Contratos", desc: "Gestão de contratos, aditivos e ajustes temporários." },
              { icon: BarChart3, title: "Medições", desc: "Registro de horímetros e cálculo automático de horas." },
              { icon: Shield, title: "Apólices", desc: "Controle de seguros, sinistros e vencimentos." },
            ].map((f, i) => (
              <div key={i} className="text-center space-y-3 p-6 rounded-2xl bg-background border border-border hover:shadow-md transition-shadow">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Busato Locações Ltda. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
