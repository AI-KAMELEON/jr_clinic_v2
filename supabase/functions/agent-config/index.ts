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
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // GET - pobierz konfigurację
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("agent_config")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        throw error;
      }

      return new Response(
        JSON.stringify({
          success: true,
          config: data || {
            elevenlabs_agent_id: "",
            twilio_phone_number: "",
            agent_greeting: "Dzień dobry! Jak mogę pomóc?",
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // POST/PUT - zapisz konfigurację
    if (req.method === "POST" || req.method === "PUT") {
      const body = await req.json();
      const {
        elevenlabs_agent_id,
        twilio_phone_number,
        agent_greeting,
      } = body;

      // Walidacja wymaganych pól
      if (!elevenlabs_agent_id || !twilio_phone_number) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Agent ID i numer telefonu są wymagane",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Sprawdź czy istnieje już konfiguracja
      const { data: existing } = await supabase
        .from("agent_config")
        .select("id")
        .single();

      const configData = {
        elevenlabs_agent_id,
        twilio_phone_number,
        agent_greeting: agent_greeting || "Dzień dobry! Jak mogę pomóc?",
        updated_at: new Date().toISOString(),
      };

      let result;
      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from("agent_config")
          .update(configData)
          .eq("id", existing.id)
          .select()
          .single();
        result = { data, error };
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("agent_config")
          .insert(configData)
          .select()
          .single();
        result = { data, error };
      }

      if (result.error) throw result.error;

      return new Response(
        JSON.stringify({
          success: true,
          message: "Konfiguracja zapisana pomyślnie",
          config: result.data,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in agent-config:", error);
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

