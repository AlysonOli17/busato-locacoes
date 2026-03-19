import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SeedAdminSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  nome: z.string().min(1).max(255).trim().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();
    if (!callerRole || callerRole.role !== "admin") {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const validated = SeedAdminSchema.parse(body);

    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", validated.email)
      .limit(1);

    if (existingProfiles && existingProfiles.length > 0) {
      return new Response(JSON.stringify({ message: "User already exists", email: validated.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: validated.email,
      password: validated.password,
      email_confirm: true,
      user_metadata: { nome: validated.nome || "Administrador" },
    });

    if (authError) throw authError;

    const userId = authUser.user.id;

    await supabaseAdmin
      .from("profiles")
      .update({ nome: validated.nome || "Administrador", status: "Ativo" })
      .eq("user_id", userId);

    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    return new Response(
      JSON.stringify({ message: "Admin created", email: validated.email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const isZodError = error instanceof z.ZodError;
    const message = isZodError ? "Invalid input" : (error instanceof Error ? error.message : "Unknown error");
    return new Response(JSON.stringify({ error: message }), {
      status: isZodError ? 400 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
