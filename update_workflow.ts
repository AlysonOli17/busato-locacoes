import fs from 'fs';

let content = fs.readFileSync('src/pages/Faturamento.tsx', 'utf-8');

// 1. Add useAuth
if (!content.includes('import { useAuth } from "@/contexts/AuthContext"')) {
  content = content.replace(
    'import { useState, useEffect, useCallback } from "react";',
    'import { useState, useEffect, useCallback } from "react";\nimport { useAuth } from "@/contexts/AuthContext";'
  );
}

// 2. Add Send to lucide-react imports
if (!content.includes('Send,') && !content.includes(', Send')) {
  content = content.replace('Mail } from "lucide-react";', 'Mail, Send } from "lucide-react";');
}

// 3. Add useAuth hook inside Faturamento component
if (!content.includes('const { role, profile } = useAuth();')) {
  content = content.replace(
    'export function Faturamento() {\n',
    'export function Faturamento() {\n  const { role, profile } = useAuth();\n'
  );
}

// 4. Add states for SolicitarAprovacao
if (!content.includes('solicitarAprovacaoDialog')) {
  content = content.replace(
    'const [aprovarDialog, setAprovarDialog]',
    'const [solicitarAprovacaoDialog, setSolicitarAprovacaoDialog] = useState<{ isOpen: boolean; faturaId: string | null; responsavelId: string }>({ isOpen: false, faturaId: null, responsavelId: "" });\n  const [usuarios, setUsuarios] = useState<any[]>([]);\n  const [aprovarDialog, setAprovarDialog]'
  );
}

// 5. Fetch usuarios
if (!content.includes('fetchUsuarios()')) {
  content = content.replace(
    'useEffect(() => { fetchData(); }, []);',
    'const fetchUsuarios = async () => {\n    const { data } = await supabase.from("usuarios").select("id, nome, role").eq("status", "Ativo");\n    if (data) setUsuarios(data);\n  };\n  useEffect(() => { fetchData(); fetchUsuarios(); }, []);'
  );
}

// 6. Update handleSave to force Pendente on edit and update Agenda
if (content.includes('const { error } = await supabase.from("faturamento").update(payload).eq("id", editing.id);')) {
  // First, force payload.status = "Pendente" if editing
  content = content.replace(
    'if (editing) {\n      const { error } = await supabase.from("faturamento").update(payload).eq("id", editing.id);',
    'if (editing) {\n      payload.status = "Pendente";\n      const { error } = await supabase.from("faturamento").update(payload).eq("id", editing.id);\n      \n      // Force agenda back to Em Andamento\n      const { data: fat } = await supabase.from("faturamento").select("agenda_event_id").eq("id", editing.id).single();\n      if (fat?.agenda_event_id) {\n        await supabase.from("agenda").update({ status: "Em Andamento" }).eq("id", fat.agenda_event_id);\n      }'
  );
}

// 7. Add handleSolicitarAprovacao
if (!content.includes('handleSolicitarAprovacao')) {
  content = content.replace(
    'const handleAprovarMedicaoDirect = async (faturaId: string, emissaoDate: string) => {',
    `const handleSolicitarAprovacao = async () => {
    const { faturaId, responsavelId } = solicitarAprovacaoDialog;
    if (!faturaId) return;
    
    await supabase.from("faturamento").update({ status: "Aguardando Aprovação" }).eq("id", faturaId);
    
    const { data: fatura } = await supabase.from("faturamento").select("agenda_event_id").eq("id", faturaId).single();
    if (fatura?.agenda_event_id) {
       await supabase.from("agenda").update({
         status: "Aguardando Aprovação",
         responsavel_id: responsavelId || null
       }).eq("id", fatura.agenda_event_id);
    }
    
    toast({ title: "Enviado para aprovação", description: "O status foi atualizado." });
    setSolicitarAprovacaoDialog({ isOpen: false, faturaId: null, responsavelId: "" });
    fetchData();
  };

  const handleAprovarMedicaoDirect = async (faturaId: string, emissaoDate: string) => {`
  );
}

// 8. Replace buttons in the table
const oldAcoes = `                            {getDisplayStatus(item) === "Pendente" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                                title="Aprovar Medição"
                                onClick={() => setAprovarDialog({ isOpen: true, faturaId: item.id, emissaoDate: new Date().toISOString().slice(0, 10) })}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                              title="Editar Medição"
                              onClick={() => openEdit(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                              title="Exportar PDF da Medição"
                              onClick={() => exportDetailedPDF(item)}
                            >
                              <FileDown className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                              title="Enviar por E-mail"
                              onClick={() => handleSendEmail(item)}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </Button>`;

const newAcoes = `                            {getDisplayStatus(item) === "Pendente" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
                                title="Enviar para Aprovação"
                                onClick={() => setSolicitarAprovacaoDialog({ isOpen: true, faturaId: item.id, responsavelId: "" })}
                              >
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {getDisplayStatus(item) === "Aguardando Aprovação" && (role === "admin" || role === "super_admin") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-success hover:text-success hover:bg-success/10"
                                title="Aprovar Medição"
                                onClick={() => setAprovarDialog({ isOpen: true, faturaId: item.id, emissaoDate: new Date().toISOString().slice(0, 10) })}
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                              title="Editar Medição"
                              onClick={() => openEdit(item)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Exportar PDF da Medição"
                              onClick={() => exportDetailedPDF(item)}
                              disabled={getDisplayStatus(item) !== "Aprovado" && getDisplayStatus(item) !== "Pago" && role !== "admin" && role !== "super_admin"}
                            >
                              <FileDown className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Enviar por E-mail"
                              onClick={() => handleSendEmail(item)}
                              disabled={getDisplayStatus(item) !== "Aprovado" && getDisplayStatus(item) !== "Pago" && role !== "admin" && role !== "super_admin"}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </Button>`;

if (content.includes(oldAcoes)) {
  content = content.replace(oldAcoes, newAcoes);
}

// 9. Add SolicitarAprovacaoDialog JSX
const dialogJSX = `      {/* Custom Fatura Approval Dialog */}
      <Dialog open={solicitarAprovacaoDialog.isOpen} onOpenChange={(open) => !open && setSolicitarAprovacaoDialog(prev => ({ ...prev, isOpen: false }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar para Aprovação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              A medição mudará para o status <strong>Aguardando Aprovação</strong> no Kanban.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Responsável pela Aprovação (Opcional)
              </label>
              <Select 
                value={solicitarAprovacaoDialog.responsavelId} 
                onValueChange={(v) => setSolicitarAprovacaoDialog(prev => ({ ...prev, responsavelId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário (Padrão: Admins)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Deixar para Administradores</SelectItem>
                  {usuarios.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSolicitarAprovacaoDialog(prev => ({ ...prev, isOpen: false }))}>Cancelar</Button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={handleSolicitarAprovacao}>
              Enviar para Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Fatura Approval Dialog */}`;

if (!content.includes('Enviar para Aprovação</DialogTitle>')) {
  content = content.replace('{/* Custom Fatura Approval Dialog */}', dialogJSX);
}

fs.writeFileSync('src/pages/Faturamento.tsx', content, 'utf-8');
console.log('Update complete!');
