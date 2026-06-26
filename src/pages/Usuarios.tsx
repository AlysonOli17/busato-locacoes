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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Trash2, UserCog, ShieldCheck, Lock, Shield, Settings2, UserPlus, FileText, KeyRound, History, ChevronRight, Eye, PencilLine, FilePlus, Layers } from "lucide-react";
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
  actions?: string[];
}

interface UserPerm {
  user_id: string;
  permission: string;
  actions?: string[];
}

interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  module: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ALL_ROUTES = [
  { path: "/equipamentos", label: "Equipamentos", icon: "⚙️" },
  { path: "/empresas", label: "Empresas", icon: "🏢" },
  { path: "/contratos", label: "Contratos", icon: "📄" },
  { path: "/propostas", label: "Propostas", icon: "📋" },
  { path: "/medicoes", label: "Medições", icon: "📊" },
  { path: "/faturamento", label: "Faturamento", icon: "💰" },
  { path: "/apolices", label: "Apólices", icon: "🔒" },
  { path: "/gastos", label: "Gastos", icon: "💳" },
  { path: "/controladoria", label: "Controladoria", icon: "📈" },
  { path: "/agenda", label: "Agenda & Kanban", icon: "📅" },
];

const ALL_ACTIONS = [
  { key: "view",   label: "Visualizar", icon: Eye },
  { key: "create", label: "Criar",      icon: FilePlus },
  { key: "edit",   label: "Editar",     icon: PencilLine },
  { key: "delete", label: "Excluir",    icon: Trash2 },
];

const emptyForm = { nome: "", email: "", password: "", role: "operador", status: "Ativo" };
const emptyResetPw = { newPassword: "", confirm: "" };

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

  // Reset Password
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwForm, setResetPwForm] = useState(emptyResetPw);
  const [savingPw, setSavingPw] = useState(false);

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

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");

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

  const callManageUser = async (body: Record<string, unknown>) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-user", { body });
      if (error) throw new Error(error.message || "Erro na operação");
      if (data && data.error) throw new Error(data.error);
      return data;
    } catch (e: unknown) {
      console.error("Erro ao invocar função:", e);
      throw e;
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await callManageUser({ action: "list" });
      setUsers(data as UserItem[]);
    } catch (e: unknown) {
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
      const { data: rp } = await supabase.from("role_permissions").select("role, permission, actions");
      if (rp) setRolePermissions(rp as RolePerm[]);
      const { data: up } = await supabase.from("user_permissions").select("user_id, permission, actions");
      if (up) setUserPermissions(up as UserPerm[]);
    } catch (e: unknown) {
      console.error("Erro ao buscar permissões:", e);
    }
  };

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const data = await callManageUser({ action: "get_audit_logs", limit: 200 });
      setAuditLogs((data?.data || []) as AuditLog[]);
    } catch {
      // fallback direct
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
      if (data) setAuditLogs(data as AuditLog[]);
    }
    setAuditLoading(false);
  };

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
  }, []);

  const filteredUsers = users.filter((u) =>
    u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLogs = auditLogs.filter(l =>
    l.description?.toLowerCase().includes(auditSearch.toLowerCase()) ||
    l.user_name?.toLowerCase().includes(auditSearch.toLowerCase()) ||
    l.module?.toLowerCase().includes(auditSearch.toLowerCase())
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
      const edgeRole = isCustomRole ? "operador" : form.role;

      const res = await callManageUser({ 
        action: "create", 
        email: form.email, 
        password: form.password, 
        nome: form.nome, 
        role: edgeRole 
      });

      if (isCustomRole && res && res.user_id) {
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
    } catch (e: unknown) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (userId: string) => {
    try {
      await callManageUser({ action: "delete", user_id: userId });
      toast({ title: "Usuário removido" });
      fetchUsers();
    } catch (e: unknown) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleResetPassword = async () => {
    if (!editUser) return;
    if (resetPwForm.newPassword.length < 8) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 8 caracteres.", variant: "destructive" });
      return;
    }
    if (resetPwForm.newPassword !== resetPwForm.confirm) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    setSavingPw(true);
    try {
      await callManageUser({ action: "update", user_id: editUser.user_id, password: resetPwForm.newPassword });
      toast({ title: "Senha redefinida", description: `A senha de ${editUser.nome} foi atualizada com sucesso.` });
      setResetPwOpen(false);
      setResetPwForm(emptyResetPw);
    } catch (e: unknown) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
    setSavingPw(false);
  };

  const handleEditUserUpdate = async (updates: Partial<UserItem>) => {
    if (!editUser) return;
    try {
      if (updates.role !== undefined) {
        await supabase.from("user_roles").delete().eq("user_id", editUser.user_id);
        const { error: roleError } = await supabase.from("user_roles").insert({
          id: crypto.randomUUID(),
          user_id: editUser.user_id,
          role: updates.role
        });
        if (roleError) throw roleError;
      }
      
      if (updates.status !== undefined || updates.nome !== undefined) {
        const profileUpdates: Record<string, string> = {};
        if (updates.status !== undefined) profileUpdates.status = updates.status;
        if (updates.nome !== undefined) profileUpdates.nome = updates.nome;
        const { error: profileError } = await supabase.from("profiles").update(profileUpdates).eq("user_id", editUser.user_id);
        if (profileError) throw profileError;
      }

      setEditUser({ ...editUser, ...updates });
      toast({ title: "Usuário atualizado" });
      fetchUsers();
    } catch (e: unknown) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
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
    } catch (e: unknown) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
  };

  // Granular permission helpers
  const getRoleActions = (role: string, path: string): string[] => {
    const perm = rolePermissions.find(p => p.role === role && p.permission === path);
    return perm?.actions ?? [];
  };

  const hasRouteAccess = (role: string, path: string): boolean => {
    if (role === "admin") return true;
    return rolePermissions.some(p => p.role === role && p.permission === path);
  };

  const toggleRoleAccess = (role: string, path: string, hasAccess: boolean) => {
    if (hasAccess) {
      setRolePermissions(prev => prev.filter(p => !(p.role === role && p.permission === path)));
    } else {
      setRolePermissions(prev => [...prev, { role, permission: path, actions: ["view"] }]);
    }
  };

  const toggleRoleAction = (role: string, path: string, actionKey: string, hasAction: boolean) => {
    setRolePermissions(prev => prev.map(p => {
      if (p.role === role && p.permission === path) {
        const newActions = hasAction
          ? (p.actions || []).filter(a => a !== actionKey)
          : [...(p.actions || []), actionKey];
        return { ...p, actions: newActions };
      }
      return p;
    }));
  };

  const saveGranularPermissions = async (role: string) => {
    setSavingPerms(true);
    try {
      const permsForRole = rolePermissions.filter(p => p.role === role);
      await callManageUser({
        action: "update_granular_permissions",
        role,
        permissions: permsForRole.map(p => ({ permission: p.permission, actions: p.actions ?? ["view"] })),
      });
      toast({ title: "Permissões salvas!", description: `Perfil "${roleLabel(role)}" atualizado com sucesso.` });
      fetchPermissions();
    } catch (e: unknown) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    }
    setSavingPerms(false);
  };

  const roleLabel = (r: string | null) => {
    if (!r) return "Sem perfil";
    if (r === "admin") return "Administrador";
    return r.charAt(0).toUpperCase() + r.slice(1);
  };

  const actionLabel = (action: string) => {
    const icons: Record<string, string> = { view: "👁️", create: "➕", edit: "✏️", delete: "🗑️" };
    return icons[action] ?? action;
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const auditActionColor = (action: string) => {
    if (action.includes("delete")) return "text-destructive bg-destructive/10";
    if (action.includes("create")) return "text-success bg-success/10";
    if (action.includes("reset_password")) return "text-yellow-600 bg-yellow-100";
    return "text-primary bg-primary/10";
  };

  return (
    <Layout title="Usuários & Permissões" subtitle={`${users.length} usuários cadastrados`}>
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-card border border-border shadow-sm">
          <TabsTrigger value="users" className="gap-2"><UserCog className="h-4 w-4" /> Usuários</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2"><ShieldCheck className="h-4 w-4" /> Perfis & Acessos</TabsTrigger>
          <TabsTrigger value="audit" className="gap-2" onClick={() => { if (auditLogs.length === 0) fetchAuditLogs(); }}>
            <History className="h-4 w-4" /> Log de Atividades
          </TabsTrigger>
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
                const rolePerms = rolePermissions.filter(p => p.role === user.role);
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
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="bg-background">
                          <Shield className="h-3 w-3 mr-1 text-muted-foreground" /> {roleLabel(user.role)}
                        </Badge>
                        <Badge variant="secondary" className={`${user.status === 'Ativo' ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10'}`}>
                          {user.status}
                        </Badge>
                      </div>
                      {user.role !== 'admin' && rolePerms.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {rolePerms.slice(0, 4).map(p => (
                            <span key={p.permission} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              {ALL_ROUTES.find(r => r.path === p.permission)?.label ?? p.permission}
                            </span>
                          ))}
                          {rolePerms.length > 4 && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">+{rolePerms.length - 4}</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* =========================================
            TAB PERFIS & ACESSOS (GRANULAR)
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

            {/* Configuração Granular */}
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
                        : 'Ative os módulos e defina quais ações cada perfil pode executar.'}
                    </p>
                  </div>
                  {permRole !== 'admin' && (
                    <Button onClick={() => saveGranularPermissions(permRole)} disabled={savingPerms}>
                      {savingPerms ? "Salvando..." : "Salvar Permissões"}
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {ALL_ROUTES.map(route => {
                    const hasAccess = hasRouteAccess(permRole, route.path);
                    const currentActions = getRoleActions(permRole, route.path);
                    return (
                      <div key={route.path} className={`rounded-xl border transition-all ${hasAccess ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-lg ${hasAccess ? 'bg-primary/20' : 'bg-muted'}`}>
                              {route.icon}
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${hasAccess ? 'text-foreground' : 'text-muted-foreground'}`}>{route.label}</p>
                              <p className="text-[10px] text-muted-foreground">{route.path}</p>
                            </div>
                          </div>
                          <Switch
                            checked={hasAccess}
                            disabled={permRole === 'admin'}
                            onCheckedChange={(val) => toggleRoleAccess(permRole, route.path, !val)}
                          />
                        </div>

                        {/* Ações granulares */}
                        {hasAccess && permRole !== 'admin' && (
                          <div className="px-4 pb-4 pt-0 flex flex-wrap gap-3 border-t border-primary/10">
                            {ALL_ACTIONS.map(act => {
                              const checked = currentActions.includes(act.key);
                              return (
                                <label key={act.key} className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleRoleAction(permRole, route.path, act.key, checked)}
                                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                  />
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <act.icon className="h-3 w-3" />
                                    {act.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* =========================================
            TAB LOG DE ATIVIDADES
        ========================================= */}
        <TabsContent value="audit" className="animate-in fade-in-50 duration-300 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por usuário, módulo ou ação..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} className="pl-9 bg-background rounded-full" />
            </div>
            <Button variant="outline" onClick={fetchAuditLogs} disabled={auditLoading} className="w-full sm:w-auto">
              {auditLoading ? "Carregando..." : "↺ Atualizar"}
            </Button>
          </div>

          {auditLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-muted-foreground gap-3">
              <History className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma atividade registrada ainda.</p>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {filteredLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
                    <div className={`mt-0.5 text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap ${auditActionColor(log.action)}`}>
                      {log.action.replace(/_/g, " ")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{log.description}</p>
                      <div className="flex flex-wrap gap-3 mt-1">
                        <span className="text-xs text-muted-foreground font-medium">👤 {log.user_name}</span>
                        <span className="text-xs text-muted-foreground">📦 {log.module}</span>
                        <span className="text-xs text-muted-foreground">🕒 {fmtDate(log.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
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
                  <div className="flex gap-2 flex-wrap">
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
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setResetPwOpen(true)}>
                      <KeyRound className="h-3 w-3" /> Redefinir Senha
                    </Button>
                  </div>
                </SheetHeader>
              </div>

              <div className="p-6 flex-1 space-y-6">
                {/* Permissões do perfil do usuário */}
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                    <Layers className="h-4 w-4" /> Acessos via Perfil
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">Permissões herdadas do perfil <strong>{roleLabel(editUser.role)}</strong>.</p>
                  <div className="space-y-1">
                    {ALL_ROUTES.map(route => {
                      const hasRolePerm = editUser.role === 'admin' || rolePermissions.some(p => p.role === editUser.role && p.permission === route.path);
                      if (!hasRolePerm) return null;
                      const actions = getRoleActions(editUser.role || "", route.path);
                      return (
                        <div key={route.path} className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                          <span className="text-sm font-medium">{route.icon} {route.label}</span>
                          <div className="flex gap-1">
                            {(editUser.role === 'admin' ? ["view", "create", "edit", "delete"] : actions).map(a => (
                              <span key={a} title={a} className="text-xs text-muted-foreground">{actionLabel(a)}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Acessos individuais extras */}
                <div>
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
                    <Settings2 className="h-4 w-4" /> Acessos Individuais Extras
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">Módulos adicionais apenas para este usuário.</p>
                  <div className="space-y-1">
                    {ALL_ROUTES.map(route => {
                      const hasRolePerm = editUser.role === 'admin' || rolePermissions.some(p => p.role === editUser.role && p.permission === route.path);
                      const hasUserPerm = userPermissions.some(p => p.user_id === editUser.user_id && p.permission === route.path);
                      if (hasRolePerm) return null; // Already shown above
                      return (
                        <div key={route.path} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${hasUserPerm ? 'border-primary/20 bg-primary/5' : 'border-transparent hover:bg-muted/50'}`}>
                          <span className={`text-sm ${hasUserPerm ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{route.icon} {route.label}</span>
                          <Switch
                            checked={hasUserPerm}
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
                      <AlertDialogDescription>Esta ação é irreversível. O usuário {editUser.nome} será permanentemente removido do sistema.</AlertDialogDescription>
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
          DIALOG: REDEFINIR SENHA
      ========================================= */}
      <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Redefinir Senha</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Defina uma nova senha para <strong>{editUser?.nome}</strong>.</p>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nova Senha (Mín. 8 caracteres)</Label>
              <Input type="password" value={resetPwForm.newPassword} onChange={(e) => setResetPwForm(p => ({ ...p, newPassword: e.target.value }))} placeholder="••••••••" />
            </div>
            <div>
              <Label>Confirmar Senha</Label>
              <Input type="password" value={resetPwForm.confirm} onChange={(e) => setResetPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwOpen(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={savingPw}>{savingPw ? "Salvando..." : "Redefinir Senha"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
