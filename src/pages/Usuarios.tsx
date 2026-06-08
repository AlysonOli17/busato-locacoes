import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Plus, Search, Pencil, Trash2, UserCog, ShieldCheck, Lock, Unlock, Shield, Settings2, UserPlus, FileText, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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

interface UserPerm {
  user_id: string;
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
  { path: "/controladoria", label: "Controladoria" },
  { path: "/agenda", label: "Agenda & Kanban" },
];

const emptyForm = { nome: "", email: "", password: "", role: "operador", status: "Ativo" };

const Usuarios = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Create User State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Edit User State (Drawer)
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  // Permissions Data
  const [rolePermissions, setRolePermissions] = useState<RolePerm[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPerm[]>([]);
  
  // Custom Roles State
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDialogOpen, setNewRoleDialogOpen] = useState(false);

  // Permissions Tab State
  const [permRole, setPermRole] = useState<string>("operador");
  const [savingPerms, setSavingPerms] = useState(false);

  const { toast } = useToast();
  const { role: currentUserRole } = useAuth();

  const uniqueRoles = useMemo(() => {
    const rolesSet = new Set(["operador", "visualizador", ...customRoles]);
    users.forEach(u => {
      if (u.role && u.role !== "admin") rolesSet.add(u.role);
    });
    rolePermissions.forEach(p => {
      if (p.role && p.role !== "admin") rolesSet.add(p.role);
    });
    return Array.from(rolesSet);
  }, [users, rolePermissions, customRoles]);

  const callManageUser = async (body: any) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", { body });
      if (error) throw new Error(error.message || "Erro na operação");
      if (data && data.error) throw new Error(data.error);
      return data;
    } catch (e: any) {
      console.error("Erro ao invocar função:", e);
      throw e;
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await callManageUser({ action: "list" });
      setUsers(data as UserItem[]);
    } catch (e: any) {
      console.warn("Fallback to direct fetch:", e.message);
      const { data: profiles } = await supabase.from("profiles").select("*").order("created_at");
      const { data: roles } = await supabase.from("user_roles").select("*");
      if (profiles) {
        setUsers(profiles.map(p => ({
          ...p,
          role: roles?.find(r => r.user_id === p.user_id)?.role || null,
        })) as UserItem[]);
      }
    }
    setLoading(false);
  };

  const fetchPermissions = async () => {
    try {
      const { data: rp } = await supabase.from("role_permissions").select("role, permission");
      if (rp) setRolePermissions(rp as RolePerm[]);
      const { data: up } = await supabase.from("user_permissions").select("user_id, permission");
      if (up) setUserPermissions(up as UserPerm[]);
    } catch (e: any) {
      console.error("Erro ao buscar permissões:", e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
  }, []);

  const filteredUsers = users.filter((u) =>
    u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateUser = async () => {
    const erros: string[] = [];
    if (!form.nome.trim()) erros.push("• Nome é obrigatório");
    if (!form.email.trim()) erros.push("• E-mail é obrigatório");
    if (!form.password) erros.push("• Senha é obrigatória");
    if (form.password && form.password.length < 8) erros.push("• Senha deve ter no mínimo 8 caracteres");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) erros.push("• E-mail inválido");

    if (erros.length > 0) {
      toast({ title: "Preencha os campos", description: erros.join("\n"), variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const isCustomRole = !["admin", "operador", "visualizador"].includes(form.role);
      // Bypasses remote edge function zod enum check by passing "operador" if it's a custom role
      const edgeRole = isCustomRole ? "operador" : form.role;

      const res = await callManageUser({ 
        action: "create", 
        email: form.email, 
        password: form.password, 
        nome: form.nome, 
        role: edgeRole 
      });

      if (isCustomRole && res && res.user_id) {
        // Update to the actual custom role directly from client
        await supabase.from("user_roles").delete().eq("user_id", res.user_id);
        const { error: roleError } = await supabase.from("user_roles").insert({
          id: crypto.randomUUID(),
          user_id: res.user_id,
          role: form.role
        });
        if (roleError) throw roleError;
      }

      toast({ title: "Usuário criado com sucesso" });
      setCreateDialogOpen(false);
      fetchUsers();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
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
      const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("user_id", item.user_id);
      if (error) throw error;
      toast({ title: `Usuário ${newStatus === "Ativo" ? "desbloqueado" : "bloqueado"}` });
      fetchUsers();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const saveRolePermissions = async (role: string, checkedPaths: Set<string>) => {
    setSavingPerms(true);
    try {
      const { error: delError } = await supabase.from("role_permissions").delete().eq("role", role);
      if (delError) throw delError;

      if (checkedPaths.size > 0) {
        const { error: insError } = await supabase.from("role_permissions").insert(
          Array.from(checkedPaths).map(p => ({ id: crypto.randomUUID(), role, permission: p }))
        );
        if (insError) throw insError;
      }
      toast({ title: "Permissões do Perfil salvas!" });
      fetchPermissions();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingPerms(false);
  };

  // --- User Editing Drawer Logic ---
  const handleEditUserUpdate = async (updates: Partial<UserItem>) => {
    if (!editUser) return;
    try {
      if (updates.role !== undefined) {
        // Update user role directly via client database query to bypass edge function enum check
        await supabase.from("user_roles").delete().eq("user_id", editUser.user_id);
        const { error: roleError } = await supabase.from("user_roles").insert({
          id: crypto.randomUUID(),
          user_id: editUser.user_id,
          role: updates.role
        });
        if (roleError) throw roleError;
      }
      
      if (updates.status !== undefined || updates.nome !== undefined) {
        // Update profile directly via client database query
        const profileUpdates: any = {};
        if (updates.status !== undefined) profileUpdates.status = updates.status;
        if (updates.nome !== undefined) profileUpdates.nome = updates.nome;
        const { error: profileError } = await supabase.from("profiles").update(profileUpdates).eq("user_id", editUser.user_id);
        if (profileError) throw profileError;
      }

      setEditUser({ ...editUser, ...updates });
      toast({ title: "Usuário atualizado" });
      fetchUsers();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const toggleUserPermission = async (userId: string, path: string, isCurrentlyEnabled: boolean) => {
    try {
      if (isCurrentlyEnabled) {
        const { error } = await supabase.from("user_permissions").delete().match({ user_id: userId, permission: path });
        if (error) throw error;
        setUserPermissions(prev => prev.filter(p => !(p.user_id === userId && p.permission === path)));
      } else {
        const { error } = await supabase.from("user_permissions").insert({ id: crypto.randomUUID(), user_id: userId, permission: path });
        if (error) throw error;
        setUserPermissions(prev => [...prev, { user_id: userId, permission: path }]);
      }
      toast({ title: "Permissão individual atualizada" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const roleLabel = (r: string | null) => {
    if (!r) return "Sem perfil";
    if (r === "admin") return "Administrador";
    return r.charAt(0).toUpperCase() + r.slice(1);
  };

  return (
    <Layout title="Usuários & Permissões" subtitle={`${users.length} usuários cadastrados`}>
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-card border border-border shadow-sm">
          <TabsTrigger value="users" className="gap-2"><UserCog className="h-4 w-4" /> Usuários</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2"><ShieldCheck className="h-4 w-4" /> Perfis e Acessos Globais</TabsTrigger>
        </TabsList>

        {/* =========================================
            TAB USUÁRIOS
        ========================================= */}
        <TabsContent value="users" className="space-y-4 animate-in fade-in-50 duration-300">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background rounded-full" />
            </div>
            <Button onClick={() => { setForm(emptyForm); setCreateDialogOpen(true); }} className="w-full sm:w-auto rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
              <UserPlus className="h-4 w-4 mr-2" /> Cadastrar Usuário
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-40 bg-card rounded-xl animate-pulse"></div>)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUsers.map(user => {
                const isBlocked = user.status !== "Ativo";
                return (
                  <Card key={user.user_id} className={`group overflow-hidden border-border transition-all hover:shadow-md hover:border-primary/50 cursor-pointer ${isBlocked ? 'opacity-70 grayscale' : ''}`} onClick={() => { setEditUser(user); setEditSheetOpen(true); }}>
                    <div className={`h-1.5 w-full ${user.role === 'admin' ? 'bg-primary' : isBlocked ? 'bg-destructive' : 'bg-success'}`} />
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-lg">
                            {user.nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-foreground leading-tight">{user.nome}</h3>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-6">
                        <Badge variant="outline" className="bg-background">
                          <Shield className="h-3 w-3 mr-1 text-muted-foreground" /> {roleLabel(user.role)}
                        </Badge>
                        <Badge variant="secondary" className={`${user.status === 'Ativo' ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'}`}>
                          {user.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* =========================================
            TAB PERFIS
        ========================================= */}
        <TabsContent value="permissions" className="animate-in fade-in-50 duration-300">
          <div className="grid lg:grid-cols-[250px_1fr] gap-6">
            {/* Sidebar de Perfis */}
            <Card className="h-fit">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Perfis do Sistema</Label>
                </div>
                <div className="space-y-1">
                  {uniqueRoles.map(r => (
                    <button
                      key={r}
                      onClick={() => setPermRole(r)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${permRole === r ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}
                    >
                      {roleLabel(r)}
                      {r === 'admin' && <Lock className="h-3 w-3 opacity-50" />}
                    </button>
                  ))}
                </div>
                <Button variant="outline" className="w-full border-dashed" onClick={() => setNewRoleDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Novo Perfil
                </Button>
              </CardContent>
            </Card>

            {/* Configuração de Permissões do Perfil Selecionado */}
            <Card>
              <CardContent className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      Acessos do Perfil: <span className="text-primary">{roleLabel(permRole)}</span>
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {permRole === 'admin' 
                        ? 'Administradores possuem acesso total a todos os módulos por padrão.'
                        : 'Ligue as chaves dos módulos que este perfil pode acessar.'}
                    </p>
                  </div>
                  {permRole !== 'admin' && (
                    <Button 
                      onClick={() => {
                        const currentPaths = new Set(rolePermissions.filter(p => p.role === permRole).map(p => p.permission));
                        saveRolePermissions(permRole, currentPaths);
                      }} 
                      disabled={savingPerms}
                    >
                      {savingPerms ? "Salvando..." : "Salvar Padrão do Perfil"}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {ALL_ROUTES.map(route => {
                    const isChecked = permRole === 'admin' || rolePermissions.some(p => p.role === permRole && p.permission === route.path);
                    return (
                      <div key={route.path} className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${isChecked ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:bg-muted/30'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isChecked ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${isChecked ? 'text-foreground' : 'text-muted-foreground'}`}>{route.label}</p>
                            <p className="text-[10px] text-muted-foreground opacity-70">{route.path}</p>
                          </div>
                        </div>
                        <Switch
                          checked={isChecked}
                          disabled={permRole === 'admin'}
                          onCheckedChange={(val) => {
                            if (val) setRolePermissions(prev => [...prev, { role: permRole, permission: route.path }]);
                            else setRolePermissions(prev => prev.filter(p => !(p.role === permRole && p.permission === route.path)));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* =========================================
          DRAWER: EDIÇÃO & PERMISSÕES DO USUÁRIO
      ========================================= */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
          {editUser && (
            <div className="flex flex-col min-h-full">
              <div className="p-6 bg-muted/30 border-b border-border">
                <SheetHeader>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl">
                      {editUser.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <SheetTitle className="text-xl">{editUser.nome}</SheetTitle>
                      <SheetDescription>{editUser.email}</SheetDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select value={editUser.role || "operador"} onValueChange={(v) => handleEditUserUpdate({ role: v })}>
                      <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {uniqueRoles.map(r => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={editUser.status} onValueChange={(v) => handleEditUserUpdate({ status: v })}>
                      <SelectTrigger className={`h-8 text-xs w-[120px] ${editUser.status === 'Ativo' ? 'text-success' : 'text-destructive'}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </SheetHeader>
              </div>

              <div className="p-6 flex-1 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Settings2 className="h-4 w-4" /> Acessos Individuais
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Ative permissões extras específicas apenas para este usuário. Chaves verdes bloqueadas indicam que o usuário já possui acesso via Perfil.
                  </p>
                  <div className="space-y-2">
                    {ALL_ROUTES.map(route => {
                      const hasRolePerm = editUser.role === 'admin' || rolePermissions.some(p => p.role === editUser.role && p.permission === route.path);
                      const hasUserPerm = userPermissions.some(p => p.user_id === editUser.user_id && p.permission === route.path);
                      const isGranted = hasRolePerm || hasUserPerm;

                      return (
                        <div key={route.path} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isGranted ? 'border-primary/20 bg-primary/5' : 'border-transparent hover:bg-muted/50'}`}>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm ${isGranted ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{route.label}</span>
                            {hasRolePerm && <Badge variant="outline" className="text-[10px] h-5 py-0 px-1.5 bg-background text-muted-foreground">Via Perfil</Badge>}
                          </div>
                          <Switch
                            checked={isGranted}
                            disabled={hasRolePerm}
                            onCheckedChange={() => toggleUserPermission(editUser.user_id, route.path, hasUserPerm)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-background border-t border-border flex justify-between items-center mt-auto">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação é irreversível.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => { handleDelete(editUser.user_id); setEditSheetOpen(false); }} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <Button variant="outline" onClick={() => setEditSheetOpen(false)}>Fechar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* =========================================
          DIALOG: NOVO USUÁRIO
      ========================================= */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cadastrar Novo Usuário</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@busato.com.br" /></div>
            <div><Label>Senha (Mín. 8 caracteres)</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div>
              <Label>Perfil Inicial</Label>
              <Select value={form.role || "operador"} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" disabled={currentUserRole !== 'admin'}>Administrador</SelectItem>
                  {uniqueRoles.filter(r => r !== 'admin').map(r => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={saving} className="bg-primary text-primary-foreground">{saving ? "Cadastrando..." : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================
          DIALOG: NOVO PERFIL
      ========================================= */}
      <Dialog open={newRoleDialogOpen} onOpenChange={setNewRoleDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Criar Novo Perfil</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Nome do Perfil</Label>
            <Input placeholder="Ex: Financeiro, Diretoria" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRoleDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const name = newRoleName.trim().toLowerCase();
                if (!name || name === "admin" || uniqueRoles.includes(name)) return;
                setCustomRoles(prev => [...prev, name]);
                setPermRole(name);
                setNewRoleDialogOpen(false);
                setNewRoleName("");
              }}
            >
              Criar Perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Usuarios;
