import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ============================================================================
// PRIVACY UTILITIES - Inlined from _shared/privacy-utils.ts
// ============================================================================

interface SanitizedPatient {
  id: string;
  imie: string;
  nazwisko: string;
}

interface SanitizedAppointment {
  id: string;
  date: string;
  time: string;
  time_from: string;
  time_to: string;
  type: string;
  status: string;
}

interface SanitizedSlot {
  id: string;
  time: string;
  time_from: string;
  time_to: string;
  type: string;
}

/**
 * Sanitizes patient data - returns ONLY id, imie, nazwisko
 * NEVER exposes: PESEL, phone, email, address, or any other sensitive data
 */
function sanitizePatientData(patient: any): SanitizedPatient | null {
  if (!patient || !patient.id) {
    return null;
  }

  return {
    id: patient.id,
    imie: patient.imie || "",
    nazwisko: patient.nazwisko || "",
  };
}

/**
 * Sanitizes appointment data - returns only necessary fields
 * NEVER exposes: patient_id, PESEL, phone, or other sensitive data
 */
function sanitizeAppointmentData(appointment: any): SanitizedAppointment | null {
  if (!appointment || !appointment.id) {
    return null;
  }

  return {
    id: appointment.id,
    date: appointment.data || "",
    time: appointment.godzina || "",
    time_from: appointment.godzina_od || "",
    time_to: appointment.godzina_do || "",
    type: appointment.rodzaj || "",
    status: appointment.status || "",
  };
}

/**
 * Sanitizes slot data - returns only necessary fields for booking
 */
function sanitizeSlotData(slot: any): SanitizedSlot | null {
  if (!slot || !slot.id) {
    return null;
  }

  return {
    id: slot.id,
    time: slot.godzina || "",
    time_from: slot.godzina_od || "",
    time_to: slot.godzina_do || "",
    type: slot.rodzaj || "",
  };
}

/**
 * Sanitizes parameters for logging - removes sensitive data
 */
function sanitizeParamsForLogging(params: any): any {
  if (!params) {
    return {};
  }

  const sanitized: any = { ...params };

  // Remove sensitive fields
  delete sanitized.telefon;
  delete sanitized.pesel;
  delete sanitized.email;
  delete sanitized.adres;

  return sanitized;
}

/**
 * Validates UUID format
 */
function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) {
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validates date format YYYY-MM-DD
 */
function isValidDate(date: string | null | undefined): boolean {
  if (!date) {
    return false;
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return false;
  }
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Sanitizes string input - removes potential SQL injection attempts
 */
function sanitizeStringInput(input: string | null | undefined): string {
  if (!input) {
    return "";
  }
  // Remove SQL injection patterns
  return input
    .replace(/['";\\]/g, "")
    .replace(/--/g, "")
    .replace(/\/\*/g, "")
    .replace(/\*\//g, "")
    .trim();
}

// ============================================================================
// MAIN WEBHOOK HANDLER
// ============================================================================

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

// Rate limiting storage (in-memory, resets on function restart)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100; // requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds

// Helper function: Get agent config from database
async function getAgentConfig() {
  const { data, error } = await supabase
    .from("agent_config")
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Agent configuration not found. Please configure agent in UI.");
  }

  return {
    agentId: data.elevenlabs_agent_id,
    phoneNumber: data.twilio_phone_number,
    greeting: data.agent_greeting || "Dzień dobry! Jak mogę pomóc?",
  };
}

// Rate limiting check
function checkRateLimit(agentId: string): boolean {
  const now = Date.now();
  const key = `agent:${agentId}`;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    // Reset or initialize
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false; // Rate limit exceeded
  }

  record.count++;
  rateLimitStore.set(key, record);
  return true;
}

// Audit logging for function calls
async function logFunctionCall(
  conversationId: string | null,
  functionName: string,
  parameters: any,
  result: { success: boolean; error?: string }
) {
  try {
    // Log to phone_conversations if conversation exists
    if (conversationId) {
      const sanitizedParams = sanitizeParamsForLogging(parameters);
      const logEntry = {
        conversation_id: conversationId,
        function_name: functionName,
        parameters: JSON.stringify(sanitizedParams),
        result: JSON.stringify(result),
        timestamp: new Date().toISOString(),
      };

      // Store in transcript or create a separate audit log entry
      // For now, we'll append to transcript field
      const { data: existing } = await supabase
        .from("phone_conversations")
        .select("transcript")
        .eq("conversation_id", conversationId)
        .single();

      const auditLog = `[${new Date().toISOString()}] ${functionName}: ${JSON.stringify(logEntry)}\n`;
      const updatedTranscript = existing?.transcript
        ? `${existing.transcript}\n${auditLog}`
        : auditLog;

      await supabase
        .from("phone_conversations")
        .update({ transcript: updatedTranscript })
        .eq("conversation_id", conversationId);
    }
  } catch (error) {
    console.error("Error logging function call:", error);
    // Don't fail the request if logging fails
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Pobierz konfigurację agenta (zawsze świeże z bazy)
    const config = await getAgentConfig();
    const EXPECTED_AGENT_ID = config.agentId;

    // Weryfikacja webhook secret (jeśli jest skonfigurowany)
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");

    if (expectedSecret && webhookSecret !== expectedSecret) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Invalid webhook secret" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const { event, data } = body;
    const incomingAgentId = data?.agent_id || req.headers.get("x-agent-id");
    const conversationId = data?.conversation_id || null;

    // Weryfikacja agent_id
    if (incomingAgentId !== EXPECTED_AGENT_ID) {
      console.error(
        `Agent ID mismatch! Expected: ${EXPECTED_AGENT_ID}, Got: ${incomingAgentId}`
      );
      return new Response(
        JSON.stringify({ error: "Unauthorized agent" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Rate limiting check
    if (!checkRateLimit(EXPECTED_AGENT_ID)) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again later.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obsługa eventów
    switch (event) {
      case "conversation_started":
        await logConversation(data);
        break;

      case "function_call":
        const result = await handleFunctionCall(data, conversationId);
        return result;

      case "conversation_ended":
        await finalizeConversation(data);
        break;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function logConversation(data: any) {
  try {
    const { conversation_id, agent_id, phone_number } = data;

    await supabase.from("phone_conversations").upsert(
      {
        conversation_id,
        agent_id,
        phone_number: phone_number || null,
        started_at: new Date().toISOString(),
        status: "active",
      },
      {
        onConflict: "conversation_id",
      }
    );
  } catch (error) {
    console.error("Error logging conversation:", error);
  }
}

async function finalizeConversation(data: any) {
  try {
    const {
      conversation_id,
      ended_at,
      duration_seconds,
      transcript,
    } = data;

    await supabase
      .from("phone_conversations")
      .update({
        ended_at: ended_at || new Date().toISOString(),
        duration_seconds: duration_seconds || null,
        transcript: transcript || null,
        status: "completed",
      })
      .eq("conversation_id", conversation_id);
  } catch (error) {
    console.error("Error finalizing conversation:", error);
  }
}

async function handleFunctionCall(data: any, conversationId: string | null) {
  const { function_name, parameters } = data;
  let result: Response;
  let resultBody: any = { success: false };

  try {
    // Call MCP Server as backend
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const mcpRequest = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: function_name,
        arguments: parameters,
      },
    };

    const mcpResponse = await fetch(
      `${supabaseUrl}/functions/v1/mcp-server`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify(mcpRequest),
      }
    );

    if (!mcpResponse.ok) {
      throw new Error(`MCP Server error: ${mcpResponse.status}`);
    }

    const mcpResult = await mcpResponse.json();

    // Extract result from MCP response
    if (mcpResult.error) {
      resultBody = {
        success: false,
        error: mcpResult.error.message || "MCP Server error",
      };
      result = new Response(
        JSON.stringify(resultBody),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      // MCP result contains the tool execution result
      resultBody = mcpResult.result || { success: false };
      result = new Response(
        JSON.stringify(resultBody),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("Error calling MCP Server:", error);
    resultBody = { success: false, error: error.message || "Internal server error" };
    result = new Response(
      JSON.stringify(resultBody),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Audit logging
  await logFunctionCall(conversationId, function_name, parameters, resultBody);

  return result;
}

async function verifyPatient(params: {
  telefon: string;
}) {
  try {
    // Walidacja - telefon jest wymagany
    if (!params.telefon || typeof params.telefon !== "string") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Numer telefonu jest wymagany do weryfikacji",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sanityzacja i normalizacja numeru telefonu
    const normalizedPhone = sanitizeStringInput(params.telefon).replace(/\s/g, "");

    const { data, error } = await supabase
      .from("pacjenci")
      .select("id, imie, nazwisko")
      .eq("telefon", normalizedPhone)
      .single();

    if (error || !data) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nie znaleziono pacjenta o podanym numerze telefonu",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sanityzacja danych pacjenta - TYLKO imie i nazwisko
    const sanitized = sanitizePatientData(data);

    return new Response(
      JSON.stringify({
        success: true,
        patient_id: sanitized?.id || "",
        name: sanitized ? `${sanitized.imie} ${sanitized.nazwisko}` : "",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Błąd weryfikacji pacjenta",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function getAvailableSlots(params: { data?: string }) {
  try {
    let targetDate = params.data || new Date().toISOString().split("T")[0];

    // Walidacja daty
    if (params.data && !isValidDate(params.data)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Nieprawidłowy format daty. Użyj YYYY-MM-DD",
          slots: [],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Znajdź wolne sloty (gdzie pacjent_id IS NULL i status = 'zaplanowana')
    const { data: slots, error } = await supabase
      .from("wizyty")
      .select("id, godzina, godzina_od, godzina_do, rodzaj")
      .eq("data", targetDate)
      .eq("status", "zaplanowana")
      .is("pacjent_id", null)
      .order("godzina");

    if (error) {
      throw error;
    }

    // Sanityzacja slotów
    const sanitizedSlots = (slots || [])
      .map((s) => sanitizeSlotData(s))
      .filter((s) => s !== null);

    return new Response(
      JSON.stringify({
        success: true,
        slots: sanitizedSlots,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Błąd pobierania terminów",
        slots: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function getPatientAppointments(params: {
  patient_id: string;
  data?: string;
}) {
  try {
    // Walidacja - patient_id jest wymagany i musi być UUID
    if (!params.patient_id || !isValidUUID(params.patient_id)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "patient_id jest wymagany i musi być prawidłowym UUID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Walidacja daty jeśli podana
    if (params.data && !isValidDate(params.data)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nieprawidłowy format daty. Użyj YYYY-MM-DD",
          appointments: [],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const query = supabase
      .from("wizyty")
      .select("id, data, godzina, godzina_od, godzina_do, rodzaj, status")
      .eq("pacjent_id", params.patient_id)
      .eq("status", "zaplanowana");

    // Jeśli podano datę, filtruj po dacie
    if (params.data) {
      query.eq("data", params.data);
    } else {
      // Tylko przyszłe wizyty (od dzisiaj)
      query.gte("data", new Date().toISOString().split("T")[0]);
    }

    query.order("data").order("godzina");

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Sanityzacja wizyt - tylko niezbędne pola
    const sanitizedAppointments = (data || [])
      .map((a) => sanitizeAppointmentData(a))
      .filter((a) => a !== null);

    return new Response(
      JSON.stringify({
        success: true,
        appointments: sanitizedAppointments,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Błąd pobierania wizyt",
        appointments: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function bookAppointment(params: {
  patient_id: string;
  appointment_id: string;
}) {
  try {
    // Walidacja parametrów
    if (!params.patient_id || !isValidUUID(params.patient_id)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "patient_id jest wymagany i musi być prawidłowym UUID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!params.appointment_id || !isValidUUID(params.appointment_id)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "appointment_id jest wymagany i musi być prawidłowym UUID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sprawdź czy slot jest wolny
    const { data: slot, error: checkError } = await supabase
      .from("wizyty")
      .select("id, pacjent_id, status")
      .eq("id", params.appointment_id)
      .single();

    if (checkError || !slot) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nie znaleziono terminu wizyty",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (slot.pacjent_id !== null) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Termin jest już zajęty",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (slot.status !== "zaplanowana") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Termin nie jest dostępny do rezerwacji",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error } = await supabase
      .from("wizyty")
      .update({
        pacjent_id: params.patient_id,
      })
      .eq("id", params.appointment_id);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Wizyta zarezerwowana pomyślnie",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Błąd rezerwacji wizyty",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function cancelAppointment(params: {
  appointment_id: string;
}) {
  try {
    // Walidacja parametrów
    if (!params.appointment_id || !isValidUUID(params.appointment_id)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "appointment_id jest wymagany i musi być prawidłowym UUID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error } = await supabase
      .from("wizyty")
      .update({
        status: "odwolana",
        pacjent_id: null,
      })
      .eq("id", params.appointment_id);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Wizyta anulowana pomyślnie",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Błąd anulowania wizyty",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function addNote(params: {
  patient_id: string;
  appointment_id: string;
  note_text: string;
}) {
  try {
    // Walidacja parametrów
    if (!params.patient_id || !isValidUUID(params.patient_id)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "patient_id jest wymagany i musi być prawidłowym UUID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!params.appointment_id || !isValidUUID(params.appointment_id)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "appointment_id jest wymagany i musi być prawidłowym UUID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!params.note_text || typeof params.note_text !== "string") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "note_text jest wymagany",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Weryfikacja że wizyta należy do pacjenta
    const { data: appointment, error: checkError } = await supabase
      .from("wizyty")
      .select("id, pacjent_id")
      .eq("id", params.appointment_id)
      .single();

    if (checkError || !appointment) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nie znaleziono wizyty",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (appointment.pacjent_id !== params.patient_id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Wizyta nie należy do tego pacjenta",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sanityzacja tekstu notatki
    const sanitizedNote = sanitizeStringInput(params.note_text);

    // Dodaj notatkę (append do istniejącej lub utwórz nową)
    const { data: currentAppointment } = await supabase
      .from("wizyty")
      .select("notatki")
      .eq("id", params.appointment_id)
      .single();

    const existingNotes = currentAppointment?.notatki || "";
    const newNotes = existingNotes
      ? `${existingNotes}\n${sanitizedNote}`
      : sanitizedNote;

    const { error } = await supabase
      .from("wizyty")
      .update({
        notatki: newNotes,
      })
      .eq("id", params.appointment_id);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notatka dodana pomyślnie",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Błąd dodawania notatki",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function updateNote(params: {
  appointment_id: string;
  note_text: string;
}) {
  try {
    // Walidacja parametrów
    if (!params.appointment_id || !isValidUUID(params.appointment_id)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "appointment_id jest wymagany i musi być prawidłowym UUID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!params.note_text || typeof params.note_text !== "string") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "note_text jest wymagany",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sprawdź czy wizyta istnieje
    const { data: appointment, error: checkError } = await supabase
      .from("wizyty")
      .select("id")
      .eq("id", params.appointment_id)
      .single();

    if (checkError || !appointment) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nie znaleziono wizyty",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sanityzacja tekstu notatki
    const sanitizedNote = sanitizeStringInput(params.note_text);

    const { error } = await supabase
      .from("wizyty")
      .update({
        notatki: sanitizedNote,
      })
      .eq("id", params.appointment_id);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notatka zaktualizowana pomyślnie",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Błąd aktualizacji notatki",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function rescheduleAppointment(params: {
  old_appointment_id: string;
  new_appointment_id: string;
  patient_id: string;
}) {
  try {
    // Walidacja parametrów
    if (!params.patient_id || !isValidUUID(params.patient_id)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "patient_id jest wymagany i musi być prawidłowym UUID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!params.old_appointment_id || !isValidUUID(params.old_appointment_id)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "old_appointment_id jest wymagany i musi być prawidłowym UUID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!params.new_appointment_id || !isValidUUID(params.new_appointment_id)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "new_appointment_id jest wymagany i musi być prawidłowym UUID",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sprawdź czy stara wizyta należy do pacjenta
    const { data: oldAppointment, error: oldError } = await supabase
      .from("wizyty")
      .select("id, pacjent_id, status")
      .eq("id", params.old_appointment_id)
      .single();

    if (oldError || !oldAppointment) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nie znaleziono starej wizyty",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (oldAppointment.pacjent_id !== params.patient_id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Stara wizyta nie należy do tego pacjenta",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Sprawdź czy nowy slot jest wolny
    const { data: newSlot, error: newError } = await supabase
      .from("wizyty")
      .select("id, pacjent_id, status")
      .eq("id", params.new_appointment_id)
      .single();

    if (newError || !newSlot) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nie znaleziono nowego terminu",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (newSlot.pacjent_id !== null) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nowy termin jest już zajęty",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (newSlot.status !== "zaplanowana") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nowy termin nie jest dostępny",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Transakcja: anuluj starą + zarezerwuj nową
    // W Supabase nie mamy transakcji, więc robimy sekwencyjnie
    // Najpierw rezerwujemy nową (jeśli się nie uda, stara pozostaje)
    const { error: bookError } = await supabase
      .from("wizyty")
      .update({
        pacjent_id: params.patient_id,
      })
      .eq("id", params.new_appointment_id);

    if (bookError) {
      throw bookError;
    }

    // Potem anulujemy starą
    const { error: cancelError } = await supabase
      .from("wizyty")
      .update({
        status: "odwolana",
        pacjent_id: null,
      })
      .eq("id", params.old_appointment_id);

    if (cancelError) {
      // Rollback: zwolnij nową rezerwację
      await supabase
        .from("wizyty")
        .update({
          pacjent_id: null,
        })
        .eq("id", params.new_appointment_id);
      throw cancelError;
    }

    // Pobierz szczegóły slotów dla odpowiedzi
    const { data: oldSlot } = await supabase
      .from("wizyty")
      .select("data, godzina")
      .eq("id", params.old_appointment_id)
      .single();

    const { data: newSlotDetails } = await supabase
      .from("wizyty")
      .select("data, godzina")
      .eq("id", params.new_appointment_id)
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Wizyta przełożona pomyślnie",
        old_slot: oldSlot
          ? {
              date: oldSlot.data,
              time: oldSlot.godzina,
            }
          : null,
        new_slot: newSlotDetails
          ? {
              date: newSlotDetails.data,
              time: newSlotDetails.godzina,
            }
          : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Błąd przełożenia wizyty",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
