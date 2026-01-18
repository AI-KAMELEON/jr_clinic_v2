import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export interface AgentConfig {
  agentId: string;
  phoneNumber: string;
  greeting: string;
}

/**
 * Pobiera konfigurację agenta z bazy danych
 * @returns Konfiguracja agenta (agentId, phoneNumber, greeting)
 * @throws Error jeśli konfiguracja nie istnieje
 */
export async function getAgentConfig(): Promise<AgentConfig> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("agent_config")
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      "Agent configuration not found. Please configure agent in UI."
    );
  }

  return {
    agentId: data.elevenlabs_agent_id,
    phoneNumber: data.twilio_phone_number,
    greeting: data.agent_greeting || "Dzień dobry! Jak mogę pomóc?",
  };
}

