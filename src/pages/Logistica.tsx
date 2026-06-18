import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, Navigation, CheckCircle2, AlertCircle, PlayCircle, Loader2, GripVertical, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const COLUMNS = [
  { id: "Aguardando Checklist", title: "Aguardando Checklist", icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10" },
  { id: "Aguardando Transporte", title: "Aguardando Transporte", icon: PlayCircle, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "Em Trânsito", title: "Em Trânsito", icon: Truck, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  { id: "No Cliente / Obra", title: "No Cliente / Obra", icon: Navigation, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { id: "Retornando", title: "Retornando", icon: Truck, color: "text-orange-500", bg: "bg-orange-500/10" },
];

function SortableCard({ card }: { card: any }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="cursor-grab hover:shadow-md transition-shadow active:cursor-grabbing border border-border/60">
        <CardHeader className="p-3 pb-2 relative">
          <GripVertical className="absolute top-2 right-2 h-4 w-4 text-muted-foreground/50" />
          <div className="flex justify-between items-start pr-6">
            <CardTitle className="text-sm font-bold leading-tight">
              {card.equipamentos?.tipo} {card.equipamentos?.modelo}
            </CardTitle>
          </div>
          <CardDescription className="text-xs font-semibold mt-1 text-foreground/70 truncate flex items-center gap-1">
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md whitespace-nowrap inline-block mb-1">
              {card.equipamentos?.tag_placa || "S/ Placa"}
            </span>
            {card.empresas?.nome || "Sem Cliente"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-[10px] text-muted-foreground space-y-1">
          <p className="truncate"><strong>Info:</strong> {card.titulo}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Logistica() {
  const [cards, setCards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("agenda")
      .select(`*, equipamentos ( id, tag_placa, tipo, modelo ), contratos ( id ), empresas ( id, nome )`)
      .eq("categoria", "Logística");

    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setCards(data || []);
    setIsLoading(false);
  };

  const handleDragStart = (event: any) => setActiveId(event.active.id);

  const handleDragEnd = async (event: any) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id; // Can be a card ID or a column ID

    // Find what column the card was dropped on
    let newStatus = COLUMNS.find(c => c.id === overId)?.id;
    if (!newStatus) {
      // It was dropped on another card, find its status
      const overCard = cards.find(c => c.id === overId);
      if (overCard) newStatus = overCard.status;
    }

    if (newStatus) {
      const activeCard = cards.find(c => c.id === activeId);
      if (activeCard && activeCard.status !== newStatus) {
        // Optimistic update
        setCards(cards.map(c => c.id === activeId ? { ...c, status: newStatus } : c));
        
        const { error } = await supabase.from("agenda").update({ status: newStatus }).eq("id", activeId);
        if (error) {
          toast({ title: "Erro ao mover", description: error.message, variant: "destructive" });
          fetchCards(); // Revert
        } else {
          toast({ title: "Movido com sucesso", description: `Equipamento movido para ${newStatus}` });
        }
      }
    }
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in zoom-in-95 duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-foreground uppercase tracking-tight flex items-center gap-3">
              <Truck className="h-8 w-8 text-primary" />
              Painel de Logística
            </h1>
            <p className="text-muted-foreground mt-1 text-sm font-medium">
              Kanban de Mobilização e Desmobilização de Equipamentos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={async () => {
              const titulo = prompt("Informe o Título ou Equipamento:");
              if (!titulo) return;
              const { error } = await supabase.from("agenda").insert({
                titulo,
                categoria: "Logística",
                status: "Aguardando Checklist",
                descricao: "{\"origem\":\"Pátio\", \"destino\":\"Cliente\"}",
                data_inicio: new Date().toISOString()
              });
              if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
              else { toast({ title: "Adicionado com sucesso" }); fetchCards(); }
            }} className="gap-2 bg-primary">
              <Plus className="h-4 w-4" />
              Novo Transporte
            </Button>
            <Button onClick={fetchCards} variant="outline" className="gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Atualizar Quadro
            </Button>
          </div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)] min-h-[500px]">
            {COLUMNS.map((col) => {
              const colCards = cards.filter(c => c.status === col.id);
              return (
                <div key={col.id} className="flex-1 min-w-[280px] bg-muted/30 rounded-xl border border-border/50 flex flex-col overflow-hidden">
                  <div className={`p-3 border-b border-border/50 flex items-center gap-2 ${col.bg}`}>
                    <col.icon className={`h-4 w-4 ${col.color}`} />
                    <h3 className="font-bold text-sm text-foreground/80 uppercase tracking-wider">{col.title}</h3>
                    <span className="ml-auto text-xs font-bold text-muted-foreground bg-background px-2 py-0.5 rounded-full">
                      {colCards.length}
                    </span>
                  </div>
                  
                  <div className="flex-1 p-3 overflow-y-auto space-y-3">
                    <SortableContext id={col.id} items={colCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      {colCards.map(card => <SortableCard key={card.id} card={card} />)}
                      {colCards.length === 0 && !isLoading && (
                        <div className="text-center text-muted-foreground/50 text-xs py-8 border-2 border-dashed border-border/50 rounded-lg">
                          Arraste para cá
                        </div>
                      )}
                    </SortableContext>
                  </div>
                </div>
              );
            })}
          </div>
          <DragOverlay>
            {activeId ? <SortableCard card={cards.find(c => c.id === activeId)} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </Layout>
  );
}
