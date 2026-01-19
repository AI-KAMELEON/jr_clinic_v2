import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Helper: Get administrator ID from email
async function getAdministratorId(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("administrators")
    .select("id")
    .eq("email", email)
    .single();

  if (error || !data) return null;
  return data.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user?.email) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminId = await getAdministratorId(user.email);
    if (!adminId) {
      return new Response(
        JSON.stringify({ error: "User is not an administrator" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET - List all email accounts for this administrator
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("email_accounts")
        .select("*")
        .eq("administrator_id", adminId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Don't return encrypted tokens/passwords
      const safeData = data.map((account) => ({
        ...account,
        oauth2_access_token_encrypted: undefined,
        oauth2_refresh_token_encrypted: undefined,
        smtp_password_encrypted: undefined,
      }));

      return new Response(
        JSON.stringify({ success: true, accounts: safeData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST - Add new email account
    if (req.method === "POST") {
      const body = await req.json();
      const {
        email_address,
        provider,
        auth_type,
        oauth2_access_token,
        oauth2_refresh_token,
        oauth2_expires_at,
        oauth2_provider_id,
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_username,
        smtp_password,
        display_name,
      } = body;

      // Validate required fields
      if (!email_address || !provider || !auth_type) {
        return new Response(
          JSON.stringify({ error: "email_address, provider, and auth_type are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate provider
      if (!["gmail", "outlook", "custom_smtp"].includes(provider)) {
        return new Response(
          JSON.stringify({ error: "Invalid provider. Must be: gmail, outlook, or custom_smtp" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate auth_type
      if (!["oauth2", "smtp"].includes(auth_type)) {
        return new Response(
          JSON.stringify({ error: "Invalid auth_type. Must be: oauth2 or smtp" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Prepare account data
      const accountData: any = {
        administrator_id: adminId,
        email_address,
        provider,
        auth_type,
        display_name: display_name || email_address,
      };

      // Handle OAuth2
      if (auth_type === "oauth2") {
        if (!oauth2_access_token || !oauth2_refresh_token) {
          return new Response(
            JSON.stringify({ error: "OAuth2 tokens are required for oauth2 auth_type" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accountData.oauth2_access_token_encrypted = oauth2_access_token; // TODO: Encrypt in Vault
        accountData.oauth2_refresh_token_encrypted = oauth2_refresh_token; // TODO: Encrypt in Vault
        accountData.oauth2_expires_at = oauth2_expires_at || null;
        accountData.oauth2_provider_id = oauth2_provider_id || provider;
      }

      // Handle SMTP
      if (auth_type === "smtp") {
        if (!smtp_host || !smtp_port || !smtp_username || !smtp_password) {
          return new Response(
            JSON.stringify({ error: "SMTP credentials are required for smtp auth_type" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        accountData.smtp_host = smtp_host;
        accountData.smtp_port = parseInt(smtp_port);
        accountData.smtp_secure = smtp_secure || false;
        accountData.smtp_username = smtp_username;
        accountData.smtp_password_encrypted = smtp_password; // TODO: Encrypt in Vault
      }

      const { data, error } = await supabase
        .from("email_accounts")
        .insert(accountData)
        .select()
        .single();

      if (error) throw error;

      // Remove sensitive data from response
      const safeData = {
        ...data,
        oauth2_access_token_encrypted: undefined,
        oauth2_refresh_token_encrypted: undefined,
        smtp_password_encrypted: undefined,
      };

      return new Response(
        JSON.stringify({ success: true, account: safeData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PUT - Update email account
    if (req.method === "PUT") {
      const body = await req.json();
      const { id, ...updates } = body;

      if (!id) {
        return new Response(
          JSON.stringify({ error: "Account ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      const { data: existing } = await supabase
        .from("email_accounts")
        .select("administrator_id")
        .eq("id", id)
        .single();

      if (!existing || existing.administrator_id !== adminId) {
        return new Response(
          JSON.stringify({ error: "Account not found or access denied" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Handle encryption fields
      if (updates.oauth2_access_token) {
        updates.oauth2_access_token_encrypted = updates.oauth2_access_token; // TODO: Encrypt
        delete updates.oauth2_access_token;
      }
      if (updates.oauth2_refresh_token) {
        updates.oauth2_refresh_token_encrypted = updates.oauth2_refresh_token; // TODO: Encrypt
        delete updates.oauth2_refresh_token;
      }
      if (updates.smtp_password) {
        updates.smtp_password_encrypted = updates.smtp_password; // TODO: Encrypt
        delete updates.smtp_password;
      }

      const { data, error } = await supabase
        .from("email_accounts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      const safeData = {
        ...data,
        oauth2_access_token_encrypted: undefined,
        oauth2_refresh_token_encrypted: undefined,
        smtp_password_encrypted: undefined,
      };

      return new Response(
        JSON.stringify({ success: true, account: safeData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE - Delete email account
    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");

      if (!id) {
        return new Response(
          JSON.stringify({ error: "Account ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify ownership
      const { data: existing } = await supabase
        .from("email_accounts")
        .select("administrator_id")
        .eq("id", id)
        .single();

      if (!existing || existing.administrator_id !== adminId) {
        return new Response(
          JSON.stringify({ error: "Account not found or access denied" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("email_accounts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: "Account deleted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in email-config:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});





