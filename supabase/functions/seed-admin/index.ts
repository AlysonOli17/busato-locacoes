import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const adminEmail = "admin@busato.com";
    const adminPassword = "Admin@2025!";

    // Check if admin already exists
    const { data: existingProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", adminEmail)
      .limit(1);

    if (existingProfiles && existingProfiles.length > 0) {
      return new Response(JSON.stringify({ message: "Admin already exists", email: adminEmail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { nome: "Administrador" },
    });

    if (authError) throw authError;

    const userId = authUser.user.id;

    // Update profile to Ativo
    await supabaseAdmin
      .from("profiles")
      .update({ nome: "Administrador", status: "Ativo" })
      .eq("user_id", userId);

    // Assign admin role
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    return new Response(
      JSON.stringify({ message: "Admin created", email: adminEmail, password: adminPassword }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
