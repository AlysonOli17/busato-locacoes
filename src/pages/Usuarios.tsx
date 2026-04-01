import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Pencil, Trash2, UserCog, ShieldCheck, Lock, Unlock, KeyRound } from "lucide-react";
import { SortableTableHead } from "@/components/SortableTableHead";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserItem {
  user_id: string;
  nome: string;
  email: string;
  status: string;
  role: string | null;
  created_at: string;
}

interface RolePerm {
  role: string;
  permission: string;
}

const ALL_ROUTES = [
  { path: "/equipamentos", label: "Equipamentos" },
  { path: "/empresas", label: "Empresas" },
  { path: "/contratos", label: "Contratos" },
  { path: "/propostas", label: "Propostas" },
  { path: "/medicoes", label: "Medições" },
  { path: "/faturamento", label: "Faturamento" },
  { path: "/apolices", label: "Apólices" },
  { path: "/gastos", label: "Gastos" },
  { path: "/acompanhamento", label: "Acompanhamento" },
];

const emptyForm = { nome: "", email: "", password: "", role: "operador", status: "Ativo" };

const Usuarios = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Permissions tab
  const [permissions, setPermissions] = useState<RolePerm[]>([]);
  const [permRole, setPermRole] = useState<string>("operador");
  const [permChecked, setPermChecked] = useState<Set<string>>(new Set());
  const [savingPerms, setSavingPerms] = useState(false);

  const { toast } = useToast();
  const [sortCol, setSortCol] = useState("nome");
  const [sortAsc, setSortAsc] = useState(true);
  const toggleSort = (col: string) => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(true); } };

  const callManageUser = async (body: any) => {
    const res = await supabase.functions.invoke("manage-user", { body });
    if (res.error) throw new Error(res.error.message || "Erro na operação");
    return res.data;
  };

  const fetchUsers = async () => {
    try {
      const data = await callManageUser({ action: "list" });
      setUsers(data as UserItem[]);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const fetchPermissions = async () => {
    try {
      const data = await callManageUser({ action: "get_permissions" });
      setPermissions(data as RolePerm[]);
    } catch {}
  };

  useEffect(() => { fetchUsers(); fetchPermissions(); }, []);

  useEffect(() => {
    const permsForRole = permissions.filter(p => p.role === permRole).map(p => p.permission);
    setPermChecked(new Set(permsForRole));
  }, [permRole, permissions]);

  const filtered = users.filter((u) =>
    u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "nome": cmp = a.nome.localeCompare(b.nome); break;
        case "email": cmp = a.email.localeCompare(b.email); break;
        case "role": cmp = (a.role || "").localeCompare(b.role || ""); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "created_at": cmp = a.created_at.localeCompare(b.created_at); break;
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortAsc]);

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (item: UserItem) => {
    setEditing(item);
    setForm({ nome: item.nome, email: item.email, password: "", role: item.role || "operador", status: item.status });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const erros: string[] = [];
    if (!form.nome.trim()) erros.push("• Nome é obrigatório");
    if (!form.email.trim()) erros.push("• E-mail é obrigatório");
    if (!editing && !form.password) erros.push("• Senha é obrigatória");
    if (form.password && form.password.length < 8) erros.push("• Senha deve ter no mínimo 8 caracteres");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) erros.push("• E-mail inválido");

    if (erros.length > 0) {
      toast({ title: "Preencha os campos corretamente", description: erros.join("\n"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await callManageUser({
          action: "update",
          user_id: editing.user_id,
          nome: form.nome,
          role: form.role,
          status: form.status,
          ...(form.password ? { password: form.password } : {}),
        });
        toast({ title: "Usuário atualizado com sucesso" });
      } else {
        await callManageUser({
          action: "create",
          email: form.email,
          password: form.password,
          nome: form.nome,
          role: form.role,
        });
        toast({ title: "Usuário criado com sucesso" });
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (e: any) {
      const msg = e.message || "Erro desconhecido";
      const description = msg.includes("already been registered")
        ? "Este e-mail já está cadastrado no sistema."
        : msg;
      toast({ title: "Erro ao salvar usuário", description, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (userId: string) => {
    try {
      await callManageUser({ action: "delete", user_id: userId });
      toast({ title: "Usuário removido" });
      fetchUsers();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleToggleStatus = async (item: UserItem) => {
    const newStatus = item.status === "Ativo" ? "Bloqueado" : "Ativo";
    try {
      await callManageUser({ action: "update", user_id: item.user_id, status: newStatus });
      toast({ title: `Usuário ${newStatus === "Ativo" ? "desbloqueado" : "bloqueado"}` });
      fetchUsers();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const togglePerm = (path: string) => {
    setPermChecked(prev => {
      const n = new Set(prev);
      n.has(path) ? n.delete(path) : n.add(path);
      return n;
    });
  };

  const savePermissions = async () => {
    setSavingPerms(true);
    try {
      await callManageUser({
        action: "update_permissions",
        role: permRole,
        permissions: Array.from(permChecked),
      });
      toast({ title: "Permissões salvas" });
      fetchPermissions();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingPerms(false);
  };

  const roleLabel = (r: string | null) => {
    if (r === "admin") return "Administrador";
    if (r === "operador") return "Operador";
    if (r === "visualizador") return "Visualizador";
    return "Sem perfil";
  };

  const roleColor = (r: string | null) => {
    if (r === "admin") return "bg-primary text-primary-foreground";
    if (r === "operador") return "bg-accent/10 text-accent border-0";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Layout title="Usuários & Permissões" subtitle={`${users.length} usuários cadastrados`}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Button onClick={openNew} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Usuário
          </Button>
        </div>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users"><UserCog className="h-4 w-4 mr-1" /> Usuários</TabsTrigger>
            <TabsTrigger value="permissions"><ShieldCheck className="h-4 w-4 mr-1" /> Permissões</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar usuários..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="w-32">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</TableCell></TableRow>
                    ) : filtered.map((item) => (
                      <TableRow key={item.user_id}>
                        <TableCell className="font-medium text-sm">{item.nome}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.email}</TableCell>
                        <TableCell><Badge className={roleColor(item.role)}>{roleLabel(item.role)}</Badge></TableCell>
                        <TableCell>
                          <Badge className={
                            item.status === "Ativo" ? "bg-success text-success-foreground" :
                            item.status === "Pendente" ? "bg-warning text-warning-foreground" :
                            "bg-destructive/10 text-destructive"
                          }>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(item)} title={item.status === "Ativo" ? "Bloquear" : "Desbloquear"}>
                              {item.status === "Ativo" ? <Lock className="h-4 w-4 text-warning" /> : <Unlock className="h-4 w-4 text-success" />}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>Deseja realmente excluir o usuário "{item.nome}"? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(item.user_id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardContent className="p-6 space-y-6">
                <div>
                  <Label className="text-base font-semibold">Selecione o Perfil</Label>
                  <p className="text-sm text-muted-foreground mb-3">Administradores sempre têm acesso total. Configure as permissões dos outros perfis.</p>
                  <Select value={permRole} onValueChange={setPermRole}>
                    <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operador">Operador</SelectItem>
                      <SelectItem value="visualizador">Visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-base font-semibold mb-3 block">Páginas com Acesso</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ALL_ROUTES.map(route => (
                      <label key={route.path} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                        <Checkbox
                          checked={permChecked.has(route.path)}
                          onCheckedChange={() => togglePerm(route.path)}
                        />
                        <span className="text-sm font-medium">{route.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button onClick={savePermissions} disabled={savingPerms} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  {savingPerms ? "Salvando..." : "Salvar Permissões"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-accent" />{editing ? "Editar Usuário" : "Novo Usuário"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} />
            </div>
            <div>
              <Label>{editing ? "Nova Senha (deixe vazio para manter)" : "Senha"}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? "••••••••" : ""} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Perfil</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="operador">Operador</SelectItem>
                    <SelectItem value="visualizador">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Usuarios;
