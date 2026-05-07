import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Camera, CheckCircle2, AlertCircle, Settings2, Trash2, Pencil, Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addLetterhead } from "@/lib/exportUtils";

interface ChecklistItemTemplate {
  id: string;
  category: string; // "tipo" do equipamento
  description: string;
}

interface Inspection {
  id: string;
  equipmentId: string;
  equipmentName: string;
  category: string;
  date: string;
  inspector: string;
  status: "Aprovado" | "Reprovado" | "Com Ressalvas";
  checklist: { [key: string]: boolean };
  notes: string;
  photoUrl?: string;
}

const Inspecoes = () => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [templates, setTemplates] = useState<ChecklistItemTemplate[]>([]);
  const [equipments, setEquipments] = useState<any[]>([]);
  
  const [isInspOpen, setIsInspOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [search, setSearch] = useState("");

  // Forms
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedEquipId, setSelectedEquipId] = useState("");
  const [inspector, setInspector] = useState("");
  const [notes, setNotes] = useState("");
  const [currentChecklist, setCurrentChecklist] = useState<{ [key: string]: boolean }>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Settings form
  const [newCat, setNewCat] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    const savedInsp = localStorage.getItem("@busato:inspecoes");
    if (savedInsp) {
      try { setInspections(JSON.parse(savedInsp)); } catch (e) {}
    }
    
    const savedTemp = localStorage.getItem("@busato:checklist_templates");
    if (savedTemp) {
      try { setTemplates(JSON.parse(savedTemp)); } catch (e) {}
    } else {
      setTemplates([
        { id: "1", category: "Geral", description: "Estrutura física sem danos" },
        { id: "2", category: "Geral", description: "Funcionamento perfeito" },
        { id: "3", category: "Geral", description: "Limpo e lubrificado" },
      ]);
    }

    const fetchEquips = async () => {
      const { data } = await supabase.from("equipamentos").select("id, tipo, modelo, tag_placa").order("tipo");
      if (data) setEquipments(data);
    };
    fetchEquips();
  }, []);

  useEffect(() => {
    localStorage.setItem("@busato:inspecoes", JSON.stringify(inspections));
  }, [inspections]);

  useEffect(() => {
    localStorage.setItem("@busato:checklist_templates", JSON.stringify(templates));
  }, [templates]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const selectedEquipment = equipments.find(e => e.id === selectedEquipId);
  const categoryToUse = selectedEquipment?.tipo || "Geral";
  const itemsForCategory = templates.filter(t => t.category === categoryToUse || t.category === "Geral");

  const openNewInspection = () => {
    setEditingId(null);
    setSelectedEquipId("");
    setInspector("");
    setNotes("");
    setCurrentChecklist({});
    setPhotoPreview(null);
    setIsInspOpen(true);
  };

  const openEditInspection = (insp: Inspection) => {
    setEditingId(insp.id);
    setSelectedEquipId(insp.equipmentId);
    setInspector(insp.inspector);
    setNotes(insp.notes);
    setCurrentChecklist(insp.checklist);
    setPhotoPreview(insp.photoUrl || null);
    setIsInspOpen(true);
  };

  const handleDeleteInspection = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir esta inspeção?")) {
      setInspections(inspections.filter(i => i.id !== id));
      toast.success("Inspeção excluída!");
    }
  };

  const handleSaveInspection = () => {
    if (!selectedEquipId || !inspector) {
      toast.error("Preencha o equipamento e o responsável.");
      return;
    }

    if (itemsForCategory.length === 0) {
      toast.error("Não há itens de checklist para essa categoria.");
      return;
    }

    const checksPassed = itemsForCategory.filter(item => currentChecklist[item.id]).length;
    let status: Inspection["status"] = "Com Ressalvas";
    if (checksPassed === itemsForCategory.length) status = "Aprovado";
    if (checksPassed === 0) status = "Reprovado";

    const eqName = `${selectedEquipment.tipo} ${selectedEquipment.modelo} ${selectedEquipment.tag_placa ? `(${selectedEquipment.tag_placa})` : ""}`;

    const newInsp: Inspection = {
      id: editingId || crypto.randomUUID(),
      equipmentId: selectedEquipId,
      equipmentName: eqName,
      category: selectedEquipment.tipo,
      inspector,
      date: editingId ? inspections.find(i => i.id === editingId)!.date : new Date().toISOString(),
      status,
      checklist: currentChecklist,
      notes,
      photoUrl: photoPreview || undefined,
    };

    if (editingId) {
      setInspections(inspections.map(i => i.id === editingId ? newInsp : i));
      toast.success("Inspeção atualizada com sucesso!");
    } else {
      setInspections([newInsp, ...inspections]);
      toast.success("Inspeção salva!");
    }
    
    setIsInspOpen(false);
  };

  const handleAddTemplate = () => {
    if (!newCat || !newDesc) return;
    const newItem = { id: crypto.randomUUID(), category: newCat, description: newDesc };
    setTemplates([...templates, newItem]);
    setNewDesc("");
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
  };

  const handleExportPDF = async (insp: Inspection) => {
    try {
      const doc = new jsPDF();
      let y = await addLetterhead(doc, "Laudo Técnico de Inspeção");
      
      // Calculate dynamic height for the box based on equipment name length
      doc.setFontSize(11);
      const eqLines = doc.splitTextToSize(insp.equipmentName, 170);
      const eqHeight = eqLines.length * 5;
      const boxHeight = 12 + eqHeight + 24; // Dynamic height
      
      // Professional box background
      doc.setDrawColor(200);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(14, y, 182, boxHeight, 3, 3, "FD");
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text("DADOS DO EQUIPAMENTO", 18, y + 6);
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40);
      doc.setFontSize(11);
      doc.text(eqLines, 18, y + 12);
      
      let curY = y + 12 + eqHeight;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Categoria: ${insp.category}`, 18, curY);
      
      curY += 5;
      doc.setDrawColor(220);
      doc.line(14, curY, 196, curY); // subtle separator line
      
      curY += 6;
      doc.setTextColor(100);
      doc.text("INFORMAÇÕES DA INSPEÇÃO", 18, curY);
      
      curY += 6;
      doc.setTextColor(40);
      doc.text(`Inspetor: ${insp.inspector}`, 18, curY);
      doc.text(`Data: ${new Date(insp.date).toLocaleDateString("pt-BR")} às ${new Date(insp.date).toLocaleTimeString("pt-BR").slice(0, 5)}`, 85, curY);
      
      doc.setFont("helvetica", "bold");
      if (insp.status === "Aprovado") doc.setTextColor(34, 197, 94);
      else if (insp.status === "Reprovado") doc.setTextColor(239, 68, 68);
      else doc.setTextColor(234, 179, 8);
      doc.text(`Status: ${insp.status.toUpperCase()}`, 145, curY);
      
      doc.setTextColor(40);
      doc.setFont("helvetica", "normal");
      
      y = y + boxHeight + 8; // Move Y below the box
      
      const tableData = Object.keys(insp.checklist).map((itemId) => {
        const template = templates.find(t => t.id === itemId);
        const isOk = insp.checklist[itemId];
        return [
          template ? template.description : "Item removido do sistema",
          isOk ? "Conforme" : "Não Conforme"
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["Item Verificado no Checklist", "Situação"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], fontSize: 10 },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 130 },
          1: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 1) {
            if (data.cell.raw === "Conforme") {
              data.cell.styles.textColor = [34, 197, 94];
            } else {
              data.cell.styles.textColor = [239, 68, 68];
            }
          }
        }
      });

      y = (doc as any).lastAutoTable.finalY + 10;
      
      if (insp.notes) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.text("Observações e Ressalvas:", 14, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(insp.notes, 180);
        doc.text(lines, 14, y);
        y += lines.length * 5 + 6;
      }
      
      if (insp.photoUrl) {
        if (y > 180) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.text("Registro Fotográfico:", 14, y);
        y += 6;
        try {
          doc.addImage(insp.photoUrl, 'JPEG', 14, y, 120, 90, undefined, 'FAST');
          doc.setDrawColor(200);
          doc.rect(14, y, 120, 90);
          y += 96;
        } catch(e) {
          doc.setFont("helvetica", "italic");
          doc.text("(Não foi possível anexar a imagem)", 14, y);
        }
      }
      
      if (y < 250) {
        y = 260;
      } else {
        doc.addPage();
        y = 260;
      }
      doc.setDrawColor(150);
      doc.line(60, y, 150, y);
      doc.setFont("helvetica", "normal");
      doc.text(`Assinatura do Responsável (${insp.inspector})`, 105, y + 6, { align: "center" });
      
      doc.save(`Laudo_${insp.equipmentName.replace(/\W+/g, '_')}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao exportar PDF.");
    }
  };

  const filteredInspections = useMemo(() => {
    return inspections.filter(insp => {
      const searchLower = search.toLowerCase();
      return (
        insp.equipmentName.toLowerCase().includes(searchLower) ||
        insp.category.toLowerCase().includes(searchLower) ||
        insp.inspector.toLowerCase().includes(searchLower) ||
        new Date(insp.date).toLocaleDateString("pt-BR").includes(searchLower)
      );
    });
  }, [inspections, search]);

  const uniqueCategories = Array.from(new Set(equipments.map(e => e.tipo)));

  return (
    <Layout title="Inspeções de Equipamentos" subtitle="Controle de qualidade e checklist">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inspeções</h2>
          <p className="text-muted-foreground">Registre o estado dos equipamentos locados.</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar (Placa, tipo, data...)" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-full bg-background" 
            />
          </div>

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="hidden sm:flex">
                <Settings2 className="mr-2 h-4 w-4" />
                Configurar Checklists
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Itens de Inspeção por Categoria</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex gap-2 items-end bg-muted/30 p-4 rounded-md border">
                  <div className="flex-1 space-y-2">
                    <Label>Categoria</Label>
                    <Select value={newCat} onValueChange={setNewCat}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Geral">Geral (Todos)</SelectItem>
                        {uniqueCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-[2] space-y-2">
                    <Label>Descrição do Item</Label>
                    <Input placeholder="Ex: Nível de óleo do motor" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                  </div>
                  <Button onClick={handleAddTemplate}>Adicionar</Button>
                </div>

                <div className="space-y-4 mt-2">
                  {Array.from(new Set(templates.map(t => t.category))).map(cat => (
                    <div key={cat} className="border rounded-md overflow-hidden">
                      <div className="bg-muted px-4 py-2 font-semibold text-sm">{cat}</div>
                      <div className="p-2">
                        {templates.filter(t => t.category === cat).map(item => (
                          <div key={item.id} className="flex justify-between items-center py-2 px-2 hover:bg-muted/50 rounded-md">
                            <span className="text-sm">{item.description}</span>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate(item.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isInspOpen} onOpenChange={setIsInspOpen}>
            <Button onClick={openNewInspection} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nova Inspeção
            </Button>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Inspeção" : "Registrar Inspeção"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Selecione o Equipamento</Label>
                  <Select value={selectedEquipId} onValueChange={(val) => { setSelectedEquipId(val); setCurrentChecklist({}); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Buscar equipamento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {equipments.map(eq => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.tipo} {eq.modelo} {eq.tag_placa ? `(${eq.tag_placa})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Responsável pela inspeção</Label>
                  <Input placeholder="Nome do funcionário" value={inspector} onChange={(e) => setInspector(e.target.value)} />
                </div>

                {selectedEquipId && itemsForCategory.length > 0 && (
                  <div className="border rounded-md p-4 space-y-3 bg-muted/30">
                    <Label className="text-base text-primary">Checklist ({categoryToUse})</Label>
                    {itemsForCategory.map(item => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={item.id} 
                          checked={!!currentChecklist[item.id]}
                          onCheckedChange={(c) => setCurrentChecklist(prev => ({ ...prev, [item.id]: !!c }))}
                        />
                        <label htmlFor={item.id} className="text-sm font-medium leading-none">
                          {item.description}
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid gap-2">
                  <Label>Registro Fotográfico</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {photoPreview ? (
                      <div className="relative">
                        <img src={photoPreview} alt="Preview" className="max-h-[200px] mx-auto rounded-md" />
                        <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => setPhotoPreview(null)}>
                          Remover
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Camera className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <Label htmlFor="photo-upload" className="cursor-pointer text-primary hover:underline">
                          Tirar foto ou anexar
                        </Label>
                        <Input id="photo-upload" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                      </>
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Observações</Label>
                  <Input placeholder="Alguma ressalva?" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInspOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveInspection}>{editingId ? "Atualizar" : "Salvar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" className="sm:hidden w-full mt-2" onClick={() => setIsSettingsOpen(true)}>
            <Settings2 className="mr-2 h-4 w-4" /> Configurar Checklists
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredInspections.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
            Nenhuma inspeção encontrada.
          </div>
        ) : (
          filteredInspections.map((insp) => (
            <Card key={insp.id} className="overflow-hidden group">
              {insp.photoUrl && (
                <div className="h-40 w-full overflow-hidden bg-muted relative">
                  <img src={insp.photoUrl} alt="Equipamento" className="w-full h-full object-cover" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="pr-2">
                    <CardTitle className="text-lg leading-tight">{insp.equipmentName}</CardTitle>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted" onClick={() => openEditInspection(insp)} title="Editar">
                      <Pencil className="h-4 w-4 text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted" onClick={() => handleDeleteInspection(insp.id)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted" onClick={() => handleExportPDF(insp)} title="Gerar Laudo PDF">
                      <FileText className="h-4 w-4 text-primary" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground flex justify-between items-center mt-1">
                  <span>{new Date(insp.date).toLocaleDateString("pt-BR")}</span>
                  <div className="flex items-center gap-1">
                    <span className={
                      insp.status === "Aprovado" ? "text-green-600 font-medium" : 
                      insp.status === "Reprovado" ? "text-red-600 font-medium" : 
                      "text-yellow-600 font-medium"
                    }>{insp.status}</span>
                    {insp.status === "Aprovado" ? <CheckCircle2 className="text-green-500 h-4 w-4" /> : <AlertCircle className={insp.status === "Reprovado" ? "text-red-500 h-4 w-4" : "text-yellow-500 h-4 w-4"} />}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1 mb-3">
                  <p><strong>Inspetor:</strong> {insp.inspector}</p>
                  {insp.notes && <p><strong>Obs:</strong> {insp.notes}</p>}
                </div>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  {Object.keys(insp.checklist).map(itemId => {
                    const template = templates.find(t => t.id === itemId);
                    if (!template) return null;
                    const passed = insp.checklist[itemId];
                    return (
                      <span key={itemId} className={`px-2 py-0.5 rounded-full ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {template.description}
                      </span>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </Layout>
  );
};

export default Inspecoes;
