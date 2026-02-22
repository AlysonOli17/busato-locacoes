import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CreateUserSchema = z.object({
  action: z.literal("create"),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  nome: z.string().min(1).max(255).trim(),
  role: z.enum(["admin", "operador", "visualizador"]),
});

const UpdateUserSchema = z.object({
  action: z.literal("update"),
  user_id: z.string().uuid(),
  nome: z.string().min(1).max(255).trim().optional(),
  role: z.enum(["admin", "operador", "visualizador"]).optional(),
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
  role: z.enum(["admin", "operador", "visualizador"]),
  permissions: z.array(z.string().max(255)),
});

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

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const validated = CreateUserSchema.parse(body);
      const { data: authUser, error } = await supabaseAdmin.auth.admin.createUser({
        email: validated.email,
        password: validated.password,
        email_confirm: true,
        user_metadata: { nome: validated.nome },
      });
      if (error) throw error;

      await supabaseAdmin.from("profiles").update({ nome: validated.nome, status: "Ativo" }).eq("user_id", authUser.user.id);
      await supabaseAdmin.from("user_roles").insert({ user_id: authUser.user.id, role: validated.role });

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
        await supabaseAdmin.from("user_roles").insert({ user_id: validated.user_id, role: validated.role });
      }

      if (validated.password) {
        await supabaseAdmin.auth.admin.updateUserById(validated.user_id, { password: validated.password });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const validated = DeleteUserSchema.parse(body);
      await supabaseAdmin.auth.admin.deleteUser(validated.user_id);
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 400;
    const message = error instanceof z.ZodError ? "Invalid input" : error.message;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
