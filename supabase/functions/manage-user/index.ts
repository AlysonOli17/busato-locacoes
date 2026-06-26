import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CreateUserSchema = z.object({
  action: z.literal("create"),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  nome: z.string().min(1).max(255).trim(),
  role: z.string().min(1).max(50),
});

const UpdateUserSchema = z.object({
  action: z.literal("update"),
  user_id: z.string().uuid(),
  nome: z.string().min(1).max(255).trim().optional(),
  role: z.string().min(1).max(50).optional(),
  status: z.enum(["Ativo", "Bloqueado", "Pendente"]).optional(),
  password: z.string().min(8).max(128).optional(),
});

const DeleteUserSchema = z.object({
  action: z.literal("delete"),
  user_id: z.string().uuid(),
});

const ListSchema = z.object({
  action: z.literal("list"),
});

const GetPermissionsSchema = z.object({
  action: z.literal("get_permissions"),
});

const UpdatePermissionsSchema = z.object({
  action: z.literal("update_permissions"),
  role: z.string().min(1).max(50),
  permissions: z.array(z.string().max(255)),
});

const UpdateGranularPermissionsSchema = z.object({
  action: z.literal("update_granular_permissions"),
  role: z.string().min(1).max(50),
  permissions: z.array(z.object({
    permission: z.string(),
    actions: z.array(z.string()),
  })),
});

const GetAuditLogsSchema = z.object({
  action: z.literal("get_audit_logs"),
  limit: z.number().optional(),
  offset: z.number().optional(),
  module: z.string().optional(),
  user_id: z.string().optional(),
});

const RepairAuthSchema = z.object({
  action: z.literal("repair_auth"),
  email: z.string().email(),
});

// Helper to write audit log
async function writeAuditLog(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string | null,
  userName: string,
  action: string,
  module: string,
  description: string,
  metadata?: Record<string, unknown>
) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      user_name: userName,
      action,
      module,
      description,
      metadata: metadata ?? null,
    });
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !caller) throw new Error("Not authenticated");

    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();
    if (!callerRole || callerRole.role !== "admin") throw new Error("Not authorized");

    // Get caller name for audit log
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("nome")
      .eq("user_id", caller.id)
      .single();
    const callerName = callerProfile?.nome ?? caller.email ?? "Admin";

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const validated = CreateUserSchema.parse(body);
      console.log(`Creating user in Auth: ${validated.email}`);
      const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
        email: validated.email,
        password: validated.password,
        email_confirm: true,
        user_metadata: { nome: validated.nome },
      });
      if (error) {
        console.error("Auth.admin.createUser error:", error);
        throw error;
      }
      console.log("Auth user created:", authUser.user.id);

      console.log("Inserting profile...");
      const { error: pError } = await supabaseAdmin.from("profiles").insert({ 
        id: crypto.randomUUID(),
        user_id: authUser.user.id, 
        nome: validated.nome, 
        email: validated.email,
        status: "Ativo" 
      });
      if (pError) {
        console.error("Profile insert error:", pError);
        if (pError.code === '23505') {
          await supabaseAdmin.from("profiles").update({ 
            nome: validated.nome, 
            status: "Ativo" 
          }).eq("user_id", authUser.user.id);
        }
      }
      
      console.log("Inserting role...");
      const { error: rError } = await supabaseAdmin.from("user_roles").insert({ 
        id: crypto.randomUUID(),
        user_id: authUser.user.id, 
        role: validated.role 
      });
      if (rError) console.error("Role upsert error:", rError);

      await writeAuditLog(supabaseAdmin, caller.id, callerName, "create_user", "Usuários", 
        `Criou o usuário ${validated.nome} (${validated.email}) com o perfil ${validated.role}`,
        { target_user_id: authUser.user.id, email: validated.email, role: validated.role }
      );

      return new Response(JSON.stringify({ success: true, user_id: authUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const validated = UpdateUserSchema.parse(body);

      const updates: Record<string, string> = {};
      if (validated.nome !== undefined) updates.nome = validated.nome;
      if (validated.status !== undefined) updates.status = validated.status;
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from("profiles").update(updates).eq("user_id", validated.user_id);
      }

      if (validated.role) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", validated.user_id);
        await supabaseAdmin.from("user_roles").insert({ id: crypto.randomUUID(), user_id: validated.user_id, role: validated.role });
      }

      if (validated.password) {
        await supabaseAdmin.auth.admin.updateUserById(validated.user_id, { password: validated.password });
        await writeAuditLog(supabaseAdmin, caller.id, callerName, "reset_password", "Usuários",
          `Redefiniu a senha do usuário ${validated.user_id}`,
          { target_user_id: validated.user_id }
        );
      } else {
        const changes: string[] = [];
        if (validated.nome) changes.push(`nome: ${validated.nome}`);
        if (validated.status) changes.push(`status: ${validated.status}`);
        if (validated.role) changes.push(`perfil: ${validated.role}`);
        await writeAuditLog(supabaseAdmin, caller.id, callerName, "update_user", "Usuários",
          `Atualizou os dados do usuário ${validated.user_id}: ${changes.join(", ")}`,
          { target_user_id: validated.user_id, changes }
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const validated = DeleteUserSchema.parse(body);
      
      // Get info before deletion for the log
      const { data: deletedProfile } = await supabaseAdmin
        .from("profiles").select("nome, email").eq("user_id", validated.user_id).single();
      
      await supabaseAdmin.from("user_roles").delete().eq("user_id", validated.user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", validated.user_id);
      await supabaseAdmin.auth.admin.deleteUser(validated.user_id);

      await writeAuditLog(supabaseAdmin, caller.id, callerName, "delete_user", "Usuários",
        `Removeu o usuário ${deletedProfile?.nome ?? "?"} (${deletedProfile?.email ?? validated.user_id})`,
        { target_user_id: validated.user_id, nome: deletedProfile?.nome, email: deletedProfile?.email }
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      ListSchema.parse(body);
      const { data: profiles } = await supabaseAdmin.from("profiles").select("*").order("created_at");
      const { data: roles } = await supabaseAdmin.from("user_roles").select("*");
      
      const users = (profiles || []).map(p => ({
        ...p,
        role: roles?.find(r => r.user_id === p.user_id)?.role || null,
      }));
      
      return new Response(JSON.stringify(users), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    if (action === "get_permissions") {
      GetPermissionsSchema.parse(body);
      const { data: perms } = await supabaseAdmin.from("role_permissions").select("*");
      return new Response(JSON.stringify(perms || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_permissions") {
      const validated = UpdatePermissionsSchema.parse(body);
      await supabaseAdmin.from("role_permissions").delete().eq("role", validated.role);
      if (validated.permissions.length > 0) {
        await supabaseAdmin.from("role_permissions").insert(
          validated.permissions.map((p: string) => ({ role: validated.role, permission: p }))
        );
      }
      await writeAuditLog(supabaseAdmin, caller.id, callerName, "update_permissions", "Usuários",
        `Atualizou as permissões do perfil ${validated.role}`,
        { role: validated.role, permissions: validated.permissions }
      );
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_granular_permissions") {
      const validated = UpdateGranularPermissionsSchema.parse(body);
      await supabaseAdmin.from("role_permissions").delete().eq("role", validated.role);
      if (validated.permissions.length > 0) {
        await supabaseAdmin.from("role_permissions").insert(
          validated.permissions.map((p) => ({ 
            role: validated.role, 
            permission: p.permission,
            actions: p.actions,
          }))
        );
      }
      await writeAuditLog(supabaseAdmin, caller.id, callerName, "update_granular_permissions", "Usuários",
        `Atualizou as permissões granulares do perfil ${validated.role}`,
        { role: validated.role }
      );
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_audit_logs") {
      const validated = GetAuditLogsSchema.parse(body);
      let query = supabaseAdmin
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(validated.limit ?? 100)
        .range(validated.offset ?? 0, (validated.offset ?? 0) + (validated.limit ?? 100) - 1);

      if (validated.module) query = query.eq("module", validated.module);
      if (validated.user_id) query = query.eq("user_id", validated.user_id);

      const { data, count } = await query;
      return new Response(JSON.stringify({ data: data ?? [], count: count ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "repair_auth") {
      const validated = RepairAuthSchema.parse(body);
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;
      
      const userToFix = usersData.users.find(u => u.email === validated.email);
      if (userToFix) {
        await supabaseAdmin.auth.admin.deleteUser(userToFix.id);
        return new Response(JSON.stringify({ success: true, message: "Usuário limpo do Auth." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: false, message: "Usuário não encontrado no Auth." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (error) {
    const message = error instanceof z.ZodError
      ? "Invalid input: " + error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`).join(", ")
      : (error as Error).message;
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
