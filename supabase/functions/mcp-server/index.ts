import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getAgentTools } from "../_shared/agent-tools.ts";
import {
  convertToMCPTools,
  createMCPError,
  createMCPSuccess,
  validateMCPRequest,
  validateToolParams,
  findToolByName,
  createValidationError,
  createToolNotFoundError,
  createInternalError,
  createUnauthorizedError,
  createRateLimitError,
  MCP_ERROR_CODES,
  type MCPRequest,
  type MCPResponse,
} from "../_shared/mcp-protocol.ts";
import {
  sanitizePatientData,
  sanitizeAppointmentData,
  sanitizeSlotData,
  sanitizeParamsForLogging,
  sanitizeStringInput,
  isValidUUID,
  isValidDate,
} from "../_shared/privacy-utils.ts";

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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Rate limiting storage (in-memory, resets on function restart)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100; // requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds

type ScheduleSlotRow = {
  id: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  slot_unit_minutes: number;
  status: string;
};

const SLOT_BASE_MINUTES = 15;

function timeToMinutes(time: string): number {
  const [hour, minute, second] = time.split(":").map(Number);
  const total = (hour || 0) * 60 + (minute || 0);
  return Number.isFinite(second) ? total : total;
}

function minutesToTime(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor(safeMinutes % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${mins}:00`;
}

function addMinutesToTime(time: string, minutesToAdd: number): string {
  const totalMinutes = timeToMinutes(time) + minutesToAdd;
  return minutesToTime(totalMinutes);
}

function isValidDurationMinutes(durationMinutes: number): boolean {
  return durationMinutes > 0 && durationMinutes % SLOT_BASE_MINUTES === 0;
}

function buildSlotLookup(slots: ScheduleSlotRow[]) {
  const byTime = new Map<string, ScheduleSlotRow>();
  for (const slot of slots) {
    byTime.set(slot.slot_start, slot);
  }
  return byTime;
}

function findContiguousSlots(
  slots: ScheduleSlotRow[],
  startTime: string,
  durationMinutes: number
): ScheduleSlotRow[] | null {
  const requiredSlots = durationMinutes / SLOT_BASE_MINUTES;
  const lookup = buildSlotLookup(slots);
  const found: ScheduleSlotRow[] = [];

  for (let i = 0; i < requiredSlots; i += 1) {
    const time = addMinutesToTime(startTime, i * SLOT_BASE_MINUTES);
    const slot = lookup.get(time);
    if (!slot) {
      return null;
    }
    found.push(slot);
  }

  return found;
}

// Rate limiting check
function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const key = `mcp:${clientId}`;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  rateLimitStore.set(key, record);
  return true;
}

// Auth verification
function verifyAuth(req: Request): { authorized: boolean; clientId?: string } {
  const authHeader = req.headers.get("authorization");
  const apiKey = req.headers.get("apikey");
  const webhookSecret = req.headers.get("x-webhook-secret");

  // Check for Supabase anon/service role key
  const expectedAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const expectedServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const expectedAccessToken = Deno.env.get("SUPABASE_ACCESS_TOKEN");
  const expectedWebhookSecret = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");

  const providedKey = authHeader?.replace("Bearer ", "") || apiKey;

  if (
    providedKey === expectedAnonKey ||
    providedKey === expectedServiceKey ||
    providedKey === expectedAccessToken ||
    (expectedWebhookSecret && webhookSecret === expectedWebhookSecret)
  ) {
    return {
      authorized: true,
      clientId: providedKey?.substring(0, 8) || "unknown",
    };
  }

  return { authorized: false };
}

// Audit logging
async function logToolCall(
  toolName: string,
  parameters: any,
  result: { success: boolean; error?: string }
) {
  try {
    const sanitizedParams = sanitizeParamsForLogging(parameters);
    console.log(
      `[MCP] Tool: ${toolName}, Params: ${JSON.stringify(sanitizedParams)}, Result: ${JSON.stringify(result)}`
    );
  } catch (error) {
    console.error("Error logging tool call:", error);
  }
}

serve(async (req) => {
  // DEBUG: Log all incoming headers and request details
  console.log('[DEBUG MCP] Incoming request:');
  console.log('  Method:', req.method);
  console.log('  URL:', req.url);
  console.log('  Headers:');
  req.headers.forEach((value, key) => {
    const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
    console.log(`    ${key}: ${displayValue}`);
  });
  try {
    const rawBody = await req.clone().text();
    const displayBody = rawBody.length > 1000 ? rawBody.substring(0, 1000) + '...' : rawBody;
    console.log('[DEBUG MCP] Body:', displayBody);
  } catch (err) {
    console.log('[DEBUG MCP] Body: <unavailable>', err);
  }
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth verification
    const auth = verifyAuth(req);
    if (!auth.authorized) {
      return new Response(
        JSON.stringify(createUnauthorizedError(null)),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Rate limiting
    if (!checkRateLimit(auth.clientId || "unknown")) {
      return new Response(
        JSON.stringify(createRateLimitError(null)),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse and validate MCP request
    const mcpRequest: MCPRequest = await req.json();
    const validation = validateMCPRequest(mcpRequest);

    if (!validation.valid) {
      return new Response(
        JSON.stringify(
          createMCPError(
            mcpRequest?.id || null,
            MCP_ERROR_CODES.INVALID_REQUEST,
            validation.error || "Invalid request"
          )
        ),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let mcpResponse: MCPResponse;

    // Handle MCP methods
    switch (mcpRequest.method) {
      case "notifications/initialized":
        // Notification - return 200 OK (HTTP requirement, no JSON-RPC response needed)
        console.log('[DEBUG MCP] Received notifications/initialized - acknowledging with 200 OK');
        return new Response("", { status: 200, headers: corsHeaders });

      case "initialize":
        mcpResponse = {
          jsonrpc: "2.0",
          id: mcpRequest.id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: {
              tools: {},
              resources: {},
              prompts: {}
            },
            serverInfo: {
              name: "clinic-voice-agent-mcp-server",
              version: "1.0.0"
            }
          }
        };
        console.log('[DEBUG MCP] Response to initialize:', JSON.stringify(mcpResponse));
        break;

      case "tools/list":
        mcpResponse = await handleToolsList(mcpRequest.id);
        console.log('[DEBUG MCP] Response to tools/list:', JSON.stringify(mcpResponse).substring(0, 500) + '...');
        break;

      case "tools/call":
        mcpResponse = await handleToolCall(mcpRequest.id, mcpRequest.params);
        console.log('[DEBUG MCP] Response to tools/call:', JSON.stringify(mcpResponse));
        break;

      default:
        mcpResponse = createMCPError(
          mcpRequest.id,
          MCP_ERROR_CODES.METHOD_NOT_FOUND,
          `Method not found: ${mcpRequest.method}`
        );
    }

    const status = (() => {
      if (!mcpResponse.error) {
        return 200;
      }

      switch (mcpResponse.error.code) {
        case MCP_ERROR_CODES.UNAUTHORIZED:
          return 401;
        case MCP_ERROR_CODES.RATE_LIMIT_EXCEEDED:
          return 429;
        case MCP_ERROR_CODES.INTERNAL_ERROR:
          return 500;
        default:
          return 400;
      }
    })();

    return new Response(JSON.stringify(mcpResponse), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in MCP server:", error);
    const errorResponse = createInternalError(
      null,
      error.message || "Internal error"
    );
    console.log('[DEBUG MCP] Response error:', JSON.stringify(errorResponse));
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Handle tools/list
async function handleToolsList(id: string | number): Promise<MCPResponse> {
  try {
    const agentTools = getAgentTools();
    const mcpTools = convertToMCPTools(agentTools);

    return createMCPSuccess(id, {
      tools: mcpTools,
    });
  } catch (error: any) {
    return createInternalError(id, error.message || "Failed to list tools");
  }
}

// Handle tools/call
async function handleToolCall(
  id: string | number,
  params: { name: string; arguments?: any }
): Promise<MCPResponse> {
  if (!params || !params.name) {
    return createValidationError(id, "Invalid params - 'name' is required");
  }

  const toolName = params.name;
  const toolArgs = params.arguments || {};

  // Get available tools and find the requested tool
  const agentTools = getAgentTools();
  const mcpTools = convertToMCPTools(agentTools);
  const tool = findToolByName(mcpTools, toolName);

  if (!tool) {
    return createToolNotFoundError(id, toolName);
  }

  // Validate parameters against tool schema
  const paramValidation = validateToolParams(toolArgs, tool);
  if (!paramValidation.valid) {
    return createValidationError(
      id,
      paramValidation.error || "Invalid parameters",
      paramValidation.missingParams
    );
  }

  let result: any;

  try {
    switch (toolName) {
      case "verify_patient":
        result = await executeVerifyPatient(toolArgs);
        break;

      case "get_available_slots":
        result = await executeGetAvailableSlots(toolArgs);
        break;

      case "get_patient_appointments":
        result = await executeGetPatientAppointments(toolArgs);
        break;

      case "book_appointment":
        result = await executeBookAppointment(toolArgs);
        break;

      case "cancel_appointment":
        result = await executeCancelAppointment(toolArgs);
        break;

      case "add_note":
        result = await executeAddNote(toolArgs);
        break;

      case "update_note":
        result = await executeUpdateNote(toolArgs);
        break;

      case "add_callback_request":
        result = await executeAddCallbackRequest(toolArgs);
        break;

      case "reschedule_appointment":
        result = await executeRescheduleAppointment(toolArgs);
        break;

      default:
        return createToolNotFoundError(id, toolName);
    }

    // Audit logging
    await logToolCall(toolName, toolArgs, result);

    const successResponse = createMCPSuccess(id, result);
    console.log('[DEBUG MCP] Response success:', JSON.stringify(successResponse));
    return successResponse;
  } catch (error: any) {
    await logToolCall(toolName, toolArgs, {
      success: false,
      error: error.message,
    });

    const failureResponse = createInternalError(
      id,
      error.message || "Tool execution failed"
    );
    console.log('[DEBUG MCP] Response failure:', JSON.stringify(failureResponse));
    return failureResponse;
  }
}

// Tool execution functions (return data, not Response objects)

async function executeVerifyPatient(params: { telefon: string }) {
  if (!params.telefon || typeof params.telefon !== "string") {
    return {
      success: false,
      message: "Numer telefonu jest wymagany do weryfikacji",
    };
  }

  const normalizedPhone = sanitizeStringInput(params.telefon).replace(/\s/g, "");

  const { data, error } = await supabase
    .from("pacjenci")
    .select("id, imie, nazwisko")
    .eq("telefon", normalizedPhone)
    .single();

  if (error || !data) {
    return {
      success: false,
      message: "Nie znaleziono pacjenta o podanym numerze telefonu",
    };
  }

  const sanitized = sanitizePatientData(data);

  return {
    success: true,
    patient_id: sanitized?.id || "",
    name: sanitized?.imie || "",
  };
}

/**
 * Mapuje pory dnia na przedziały czasowe (godziny w formacie HH:mm:ss)
 */
function parseTimePeriod(timePeriod?: string): { start: string; end: string } | null {
  if (!timePeriod) return null;
  
  const normalized = timePeriod.toLowerCase().trim();
  
  // Mapowanie por dnia na przedziały czasowe
  const periodMap: Record<string, { start: string; end: string }> = {
    'rano': { start: '08:00:00', end: '12:00:00' },
    'morning': { start: '08:00:00', end: '12:00:00' },
    'po południu': { start: '12:00:00', end: '17:00:00' },
    'popołudnie': { start: '12:00:00', end: '17:00:00' },
    'afternoon': { start: '12:00:00', end: '17:00:00' },
    'wieczór': { start: '17:00:00', end: '20:00:00' },
    'wieczor': { start: '17:00:00', end: '20:00:00' },
    'evening': { start: '17:00:00', end: '20:00:00' },
  };
  
  const result = periodMap[normalized];
  console.log(`[DEBUG] parseTimePeriod: "${timePeriod}" -> "${normalized}" ->`, result);
  return result || null;
}

async function executeGetAvailableSlots(params: {
  data?: string;
  limit?: number;
  duration_minutes?: number;
  time_period?: string;
}) {
  const limit = Math.min(params.limit || 10, 50);
  const durationMinutes = params.duration_minutes || 30;
  const today = new Date().toISOString().split("T")[0];

  if (!isValidDurationMinutes(durationMinutes)) {
    return {
      success: false,
      error: "Nieprawidłowa długość wizyty. Użyj wielokrotności 15 minut.",
      slots: [],
    };
  }

  if (params.data && !isValidDate(params.data)) {
    return {
      success: false,
      error: "Nieprawidłowy format daty. Użyj YYYY-MM-DD",
      slots: [],
    };
  }

  const searchStart = params.data || today;
  const endDate = new Date(searchStart + "T00:00:00");
  if (!params.data) {
    endDate.setDate(endDate.getDate() + 60);
  }
  const searchEnd = params.data
    ? searchStart
    : endDate.toISOString().split("T")[0];

  let query = supabase
    .from("schedule_slots")
    .select("id, slot_date, slot_start, slot_end, slot_unit_minutes, status")
    .eq("status", "free")
    .eq("slot_unit_minutes", SLOT_BASE_MINUTES)
    .gte("slot_date", searchStart)
    .lte("slot_date", searchEnd)
    .order("slot_date", { ascending: true })
    .order("slot_start", { ascending: true });

  const { data: slots, error } = await query;

  if (error) {
    throw error;
  }

  const grouped = new Map<string, ScheduleSlotRow[]>();
  (slots || []).forEach((slot) => {
    if (!grouped.has(slot.slot_date)) {
      grouped.set(slot.slot_date, []);
    }
    grouped.get(slot.slot_date)!.push(slot);
  });

  const sanitizedSlots: Array<{
    id: string;
    date: string;
    time: string;
    time_from: string;
    time_to: string;
    duration_minutes: number;
  }> = [];

  const currentTime = new Date().toISOString().split("T")[1]?.slice(0, 8);

  // Pobierz przedział czasowy z time_period
  const timeFilter = parseTimePeriod(params.time_period);
  
  // DEBUG: Logowanie dla diagnostyki
  console.log('[DEBUG] get_available_slots params:', {
    data: params.data,
    time_period: params.time_period,
    timeFilter,
    duration_minutes: durationMinutes,
    limit,
    total_slots_from_db: slots?.length || 0
  });

  for (const [date, daySlots] of grouped) {
    console.log(`[DEBUG] Processing date ${date}, slots count: ${daySlots.length}`);
    
    const lookup = buildSlotLookup(daySlots);
    const sorted = daySlots
      .slice()
      .sort((a, b) => a.slot_start.localeCompare(b.slot_start));

    for (const slot of sorted) {
      if (sanitizedSlots.length >= limit) {
        break;
      }

      if (date === today && currentTime && slot.slot_start <= currentTime) {
        continue;
      }

      // Filtruj według time_period - sprawdź czy slot zaczyna się w zadanym przedziale czasowym
      if (timeFilter) {
        const slotTime = slot.slot_start;
        const isInRange = slotTime >= timeFilter.start && slotTime < timeFilter.end;
        console.log(`[DEBUG] Slot ${slotTime} in range ${timeFilter.start}-${timeFilter.end}: ${isInRange}`);
        
        if (!isInRange) {
          continue; // Pomiń sloty poza preferowaną porą dnia
        }
      }

      const contiguous = findContiguousSlots(
        sorted,
        slot.slot_start,
        durationMinutes
      );

      if (!contiguous) {
        console.log(`[DEBUG] No contiguous slots found for ${slot.slot_start} with duration ${durationMinutes}`);
        continue;
      }

      if (!lookup.has(slot.slot_start)) {
        continue;
      }

      sanitizedSlots.push({
        id: slot.id,
        date,
        time: slot.slot_start,
        time_from: slot.slot_start,
        time_to: addMinutesToTime(slot.slot_start, durationMinutes),
        duration_minutes: durationMinutes,
      });
    }

    if (sanitizedSlots.length >= limit) {
      break;
    }
  }

  console.log(`[DEBUG] Returning ${sanitizedSlots.length} slots`);

  return {
    success: true,
    slots: sanitizedSlots,
    count: sanitizedSlots.length,
    duration_minutes: durationMinutes,
    search_type: params.data ? "specific_date" : "next_available",
    time_period: params.time_period || null,
  };
}

async function executeGetPatientAppointments(params: {
  patient_id: string;
  data?: string;
}) {
  if (!params.patient_id || !isValidUUID(params.patient_id)) {
    return {
      success: false,
      message: "patient_id jest wymagany i musi być prawidłowym UUID",
    };
  }

  if (params.data && !isValidDate(params.data)) {
    return {
      success: false,
      message: "Nieprawidłowy format daty. Użyj YYYY-MM-DD",
      appointments: [],
    };
  }

  const query = supabase
    .from("wizyty")
    .select("id, data, godzina, godzina_od, godzina_do, rodzaj, status")
    .eq("pacjent_id", params.patient_id)
    .eq("status", "zaplanowana");

  if (params.data) {
    query.eq("data", params.data);
  } else {
    query.gte("data", new Date().toISOString().split("T")[0]);
  }

  query.order("data").order("godzina");

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const sanitizedAppointments = (data || [])
    .map((a) => sanitizeAppointmentData(a))
    .filter((a) => a !== null);

  return {
    success: true,
    appointments: sanitizedAppointments,
  };
}

async function executeBookAppointment(params: {
  patient_id: string;
  appointment_id: string;
  duration_minutes?: number;
  rodzaj?: string;
}) {
  if (!params.patient_id || !isValidUUID(params.patient_id)) {
    return {
      success: false,
      message: "patient_id jest wymagany i musi być prawidłowym UUID",
    };
  }

  if (!params.appointment_id || !isValidUUID(params.appointment_id)) {
    return {
      success: false,
      message: "appointment_id jest wymagany i musi być prawidłowym UUID",
    };
  }

  const durationMinutes = params.duration_minutes || 30;

  if (!isValidDurationMinutes(durationMinutes)) {
    return {
      success: false,
      message: "Nieprawidłowa długość wizyty. Użyj wielokrotności 15 minut.",
    };
  }

  const { data: slot, error: checkError } = await supabase
    .from("schedule_slots")
    .select("id, slot_date, slot_start, slot_unit_minutes, status")
    .eq("id", params.appointment_id)
    .single();

  if (checkError || !slot) {
    return {
      success: false,
      message: "Nie znaleziono wolnego slotu",
    };
  }

  if (slot.status !== "free") {
    return {
      success: false,
      message: "Termin jest już zajęty",
    };
  }

  if (slot.slot_unit_minutes !== SLOT_BASE_MINUTES) {
    return {
      success: false,
      message: "Wybrany slot nie jest dostępny do rezerwacji",
    };
  }

  const slotEndTime = addMinutesToTime(slot.slot_start, durationMinutes);

  const { data: daySlots, error: slotsError } = await supabase
    .from("schedule_slots")
    .select("id, slot_date, slot_start, slot_end, slot_unit_minutes, status")
    .eq("slot_date", slot.slot_date)
    .eq("status", "free")
    .eq("slot_unit_minutes", SLOT_BASE_MINUTES)
    .gte("slot_start", slot.slot_start)
    .lt("slot_start", slotEndTime)
    .order("slot_start", { ascending: true });

  if (slotsError) {
    throw slotsError;
  }

  const contiguous = findContiguousSlots(
    (daySlots || []) as ScheduleSlotRow[],
    slot.slot_start,
    durationMinutes
  );

  if (!contiguous) {
    return {
      success: false,
      message: "Wybrany termin nie jest już dostępny",
    };
  }

  const slotIds = contiguous.map((item) => item.id);
  const groupId = crypto.randomUUID();

  const { data: reservedSlots, error: reserveError } = await supabase
    .from("schedule_slots")
    .update({
      status: "booked",
      slot_group_id: groupId,
    })
    .in("id", slotIds)
    .eq("status", "free")
    .select("id");

  if (reserveError) {
    throw reserveError;
  }

  if (!reservedSlots || reservedSlots.length !== slotIds.length) {
    return {
      success: false,
      message: "Nie udało się zarezerwować slotów. Spróbuj ponownie.",
    };
  }

  const visitType = sanitizeStringInput(params.rodzaj || "").trim() || "LECZENIE";

  const { data: newVisit, error: visitError } = await supabase
    .from("wizyty")
    .insert({
      pacjent_id: params.patient_id,
      data: slot.slot_date,
      godzina: slot.slot_start,
      godzina_od: slot.slot_start,
      godzina_do: slotEndTime,
      rodzaj: visitType,
      status: "zaplanowana",
    })
    .select("id")
    .single();

  if (visitError || !newVisit) {
    await supabase
      .from("schedule_slots")
      .update({
        status: "free",
        slot_group_id: null,
      })
      .in("id", slotIds);
    throw visitError || new Error("Nie udało się utworzyć wizyty");
  }

  const { error: linkError } = await supabase
    .from("schedule_slots")
    .update({
      linked_wizyta_id: newVisit.id,
    })
    .in("id", slotIds);

  if (linkError) {
    await supabase
      .from("schedule_slots")
      .update({
        status: "free",
        slot_group_id: null,
        linked_wizyta_id: null,
      })
      .in("id", slotIds);
    await supabase.from("wizyty").delete().eq("id", newVisit.id);
    throw linkError;
  }

  return {
    success: true,
    message: "Wizyta zarezerwowana pomyślnie",
    appointment_id: newVisit.id,
    date: slot.slot_date,
    time_from: slot.slot_start,
    time_to: slotEndTime,
  };
}

async function executeCancelAppointment(params: { appointment_id: string }) {
  if (!params.appointment_id || !isValidUUID(params.appointment_id)) {
    return {
      success: false,
      message: "appointment_id jest wymagany i musi być prawidłowym UUID",
    };
  }

  const { error: slotsError } = await supabase
    .from("schedule_slots")
    .update({
      status: "free",
      slot_group_id: null,
      linked_wizyta_id: null,
    })
    .eq("linked_wizyta_id", params.appointment_id);

  if (slotsError) {
    throw slotsError;
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

  return {
    success: true,
    message: "Wizyta anulowana pomyślnie",
  };
}

async function executeAddNote(params: {
  patient_id: string;
  appointment_id: string;
  note_text: string;
}) {
  if (!params.patient_id || !isValidUUID(params.patient_id)) {
    return {
      success: false,
      message: "patient_id jest wymagany i musi być prawidłowym UUID",
    };
  }

  if (!params.appointment_id || !isValidUUID(params.appointment_id)) {
    return {
      success: false,
      message: "appointment_id jest wymagany i musi być prawidłowym UUID",
    };
  }

  if (!params.note_text || typeof params.note_text !== "string") {
    return {
      success: false,
      message: "note_text jest wymagany",
    };
  }

  const { data: appointment, error: checkError } = await supabase
    .from("wizyty")
    .select("id, pacjent_id")
    .eq("id", params.appointment_id)
    .single();

  if (checkError || !appointment) {
    return {
      success: false,
      message: "Nie znaleziono wizyty",
    };
  }

  if (appointment.pacjent_id !== params.patient_id) {
    return {
      success: false,
      message: "Wizyta nie należy do tego pacjenta",
    };
  }

  const sanitizedNote = sanitizeStringInput(params.note_text);

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

  return {
    success: true,
    message: "Notatka dodana pomyślnie",
  };
}

async function executeUpdateNote(params: {
  appointment_id: string;
  note_text: string;
}) {
  if (!params.appointment_id || !isValidUUID(params.appointment_id)) {
    return {
      success: false,
      message: "appointment_id jest wymagany i musi być prawidłowym UUID",
    };
  }

  if (!params.note_text || typeof params.note_text !== "string") {
    return {
      success: false,
      message: "note_text jest wymagany",
    };
  }

  const { data: appointment, error: checkError } = await supabase
    .from("wizyty")
    .select("id")
    .eq("id", params.appointment_id)
    .single();

  if (checkError || !appointment) {
    return {
      success: false,
      message: "Nie znaleziono wizyty",
    };
  }

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

  return {
    success: true,
    message: "Notatka zaktualizowana pomyślnie",
  };
}

async function executeAddCallbackRequest(params: {
  patient_id?: string;
  phone?: string;
  patient_name?: string;
  reason: string;
  message?: string;
  callback_date?: string;
  preferred_time?: string;
  priority?: string;
}) {
  const allowedPriorities = ["low", "normal", "high"];
  const today = new Date().toISOString().split("T")[0];

  const sanitizedReason = sanitizeStringInput(params.reason || "").slice(0, 160);
  if (!sanitizedReason) {
    return {
      success: false,
      message: "reason jest wymagany i musi zawierać krótki opis sprawy (max 160 znaków)",
    };
  }

  let patientId: string | null = null;
  let patientName = sanitizeStringInput(params.patient_name || "");
  let contactPhone = sanitizeStringInput(params.phone || "").replace(/\s+/g, "");

  if (contactPhone) {
    contactPhone = contactPhone.replace(/\D/g, "");
  }

  if (params.patient_id) {
    if (!isValidUUID(params.patient_id)) {
      return {
        success: false,
        message: "patient_id musi być prawidłowym UUID",
      };
    }

    patientId = params.patient_id;

    const { data: patient, error: patientError } = await supabase
      .from("pacjenci")
      .select("id, imie, nazwisko, telefon")
      .eq("id", params.patient_id)
      .single();

    if (patientError || !patient) {
      return {
        success: false,
        message: "Nie znaleziono pacjenta dla podanego patient_id",
      };
    }

    if (!patientName) {
      patientName = sanitizeStringInput(
        `${patient.imie || ""} ${patient.nazwisko || ""}`.trim()
      );
    }

    if (!contactPhone && patient.telefon) {
      contactPhone = sanitizeStringInput(patient.telefon).replace(/\D/g, "");
    }
  }

  if (!contactPhone) {
    return {
      success: false,
      message: "Podaj numer telefonu do oddzwonienia lub patient_id z przypisanym numerem",
    };
  }

  if (contactPhone.length < 6) {
    return {
      success: false,
      message: "Numer telefonu musi mieć co najmniej 6 cyfr",
    };
  }

  let callbackDate = today;
  if (params.callback_date) {
    if (!isValidDate(params.callback_date)) {
      return {
        success: false,
        message: "callback_date musi być w formacie YYYY-MM-DD",
      };
    }
    callbackDate = params.callback_date;
  }

  const preferredTime = sanitizeStringInput(params.preferred_time || "");
  const sanitizedMessage = sanitizeStringInput(params.message || "");

  let priority = (params.priority || "normal").toLowerCase();
  if (!allowedPriorities.includes(priority)) {
    priority = "normal";
  }

  const nowIso = new Date().toISOString();

  const insertPayload: Record<string, any> = {
    patient_id: patientId,
    phone: contactPhone,
    patient_name: patientName || null,
    reason: sanitizedReason,
    message: sanitizedMessage || null,
    callback_date: callbackDate,
    preferred_time: preferredTime || null,
    priority,
    requested_at: nowIso,
    created_via: "agent",
  };

  const { data, error } = await supabase
    .from("callback_requests")
    .insert(insertPayload)
    .select("id, status, callback_date, priority")
    .single();

  if (error) {
    throw error;
  }

  return {
    success: true,
    callback_request_id: data.id,
    status: data.status,
    callback_date: data.callback_date,
    priority: data.priority,
    message: "Zapisano prośbę o oddzwonienie. Administratorzy skontaktują się z pacjentem.",
  };
}

async function executeRescheduleAppointment(params: {
  old_appointment_id: string;
  new_appointment_id: string;
  patient_id: string;
  duration_minutes?: number;
  rodzaj?: string;
}) {
  if (!params.patient_id || !isValidUUID(params.patient_id)) {
    return {
      success: false,
      message: "patient_id jest wymagany i musi być prawidłowym UUID",
    };
  }

  if (!params.old_appointment_id || !isValidUUID(params.old_appointment_id)) {
    return {
      success: false,
      message: "old_appointment_id jest wymagany i musi być prawidłowym UUID",
    };
  }

  if (!params.new_appointment_id || !isValidUUID(params.new_appointment_id)) {
    return {
      success: false,
      message: "new_appointment_id jest wymagany i musi być prawidłowym UUID",
    };
  }

  const { data: oldAppointment, error: oldError } = await supabase
    .from("wizyty")
    .select("id, pacjent_id, status, rodzaj")
    .eq("id", params.old_appointment_id)
    .single();

  if (oldError || !oldAppointment) {
    return {
      success: false,
      message: "Nie znaleziono starej wizyty",
    };
  }

  if (oldAppointment.pacjent_id !== params.patient_id) {
    return {
      success: false,
      message: "Stara wizyta nie należy do tego pacjenta",
    };
  }

  const bookingResult = await executeBookAppointment({
    patient_id: params.patient_id,
    appointment_id: params.new_appointment_id,
    duration_minutes: params.duration_minutes,
    rodzaj: params.rodzaj || oldAppointment.rodzaj || "LECZENIE",
  });

  if (!bookingResult.success) {
    return bookingResult;
  }

  const cancelResult = await executeCancelAppointment({
    appointment_id: params.old_appointment_id,
  });

  if (!cancelResult.success) {
    return {
      success: false,
      message:
        "Nowa wizyta zarezerwowana, ale nie udało się anulować starej. Skontaktuj się z recepcją.",
      new_appointment_id: bookingResult.appointment_id,
    };
  }

  return {
    success: true,
    message: "Wizyta przełożona pomyślnie",
    old_appointment_id: params.old_appointment_id,
    new_appointment_id: bookingResult.appointment_id,
    new_slot: {
      date: bookingResult.date,
      time_from: bookingResult.time_from,
      time_to: bookingResult.time_to,
    },
  };
}

