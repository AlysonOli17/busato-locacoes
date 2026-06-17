import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CommandDialog, 
  CommandInput, 
  CommandList, 
  CommandEmpty, 
  CommandGroup, 
  CommandItem 
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { Tractor, Building2, FileText, Loader2 } from "lucide-react";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [contratos, setContratos] = useState<any[]>([]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("open-global-search", handleOpen);
    return () => window.removeEventListener("open-global-search", handleOpen);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setEquipamentos([]);
      setEmpresas([]);
      setContratos([]);
      return;
    }
  }, [open]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!query || query.length < 2) {
        setEquipamentos([]);
        setEmpresas([]);
        setContratos([]);
        return;
      }

      setLoading(true);
      
      const searchPattern = `%${query}%`;
      
      const [eqRes, emRes] = await Promise.all([
        supabase
          .from("equipamentos")
          .select("id, tipo, modelo, tag_placa")
          .or(`tipo.ilike.${searchPattern},modelo.ilike.${searchPattern},tag_placa.ilike.${searchPattern}`)
          .limit(5),
        supabase
          .from("empresas")
          .select("id, nome, documento")
          .or(`nome.ilike.${searchPattern},documento.ilike.${searchPattern}`)
          .limit(5)
      ]);

      setEquipamentos(eqRes.data || []);
      setEmpresas(emRes.data || []);
      
      if (emRes.data && emRes.data.length > 0) {
        const empresaIds = emRes.data.map(e => e.id);
        const { data: cData } = await supabase
          .from("contratos")
          .select("id, status, empresas(nome), equipamentos(tag_placa, tipo)")
          .in("empresa_id", empresaIds)
          .limit(5);
        setContratos(cData || []);
      } else {
        setContratos([]);
      }

      setLoading(false);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSelect = (callback: () => void) => {
    callback();
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput 
        placeholder="Buscar equipamentos, empresas, contratos..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="p-4 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Buscando...
          </div>
        )}
        
        {!loading && query.length > 1 && equipamentos.length === 0 && empresas.length === 0 && contratos.length === 0 && (
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        )}

        {equipamentos.length > 0 && (
          <CommandGroup heading="Equipamentos">
            {equipamentos.map((eq) => (
              <CommandItem 
                key={eq.id} 
                value={`eq-${eq.id}`}
                onSelect={() => handleSelect(() => navigate(`/equipamentos?tab=cadastro`))}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Tractor className="h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="font-medium">{eq.tipo} - {eq.modelo}</span>
                  <span className="text-xs text-muted-foreground">{eq.tag_placa || "Sem placa"}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {empresas.length > 0 && (
          <CommandGroup heading="Empresas (Clientes)">
            {empresas.map((em) => (
              <CommandItem 
                key={em.id} 
                value={`em-${em.id}`}
                onSelect={() => handleSelect(() => navigate(`/empresas`))}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Building2 className="h-4 w-4 text-emerald-600" />
                <div className="flex flex-col">
                  <span className="font-medium">{em.nome}</span>
                  <span className="text-xs text-muted-foreground">{em.documento || "S/ Documento"}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {contratos.length > 0 && (
          <CommandGroup heading="Contratos Associados">
            {contratos.map((co) => (
              <CommandItem 
                key={co.id} 
                value={`co-${co.id}`}
                onSelect={() => handleSelect(() => navigate(`/contratos`))}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FileText className="h-4 w-4 text-blue-600" />
                <div className="flex flex-col">
                  <span className="font-medium">
                    {co.empresas?.nome || "Empresa"} - {co.equipamentos?.tipo || "Eq"}
                  </span>
                  <span className="text-xs text-muted-foreground">Status: {co.status} | Placa: {co.equipamentos?.tag_placa || "N/A"}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
