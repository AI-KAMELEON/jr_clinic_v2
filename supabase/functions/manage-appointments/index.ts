import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

type ScheduleSlotRow = {
  id: string;
  slot_date: string;
  slot_start: string;
  slot_end: string;
  slot_unit_minutes: number;
  status: string;
};

const SLOT_BASE_MINUTES = 15;

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

function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
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

function normalizeStartAfter(startAfter?: string | null) {
  if (!startAfter) {
    return null;
  }
  const sanitized = startAfter.trim();
  if (!sanitized) {
    return null;
  }
  const [datePart, timePart] = sanitized.split("T");
  if (!datePart || !timePart) {
    return null;
  }
  return {
    date: datePart,
    time: timePart.length === 5 ? `${timePart}:00` : timePart,
  };
}

async function getAvailableSlots(params: {
  data?: string;
  limit?: number;
  duration_minutes?: number;
  start_after?: string;
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

  if (params.data && !/^\d{4}-\d{2}-\d{2}$/.test(params.data)) {
    return {
      success: false,
      error: "Nieprawidłowy format daty. Użyj YYYY-MM-DD",
      slots: [],
    };
  }

  const startAfter = normalizeStartAfter(params.start_after);
  const searchStart = params.data || startAfter?.date || today;
  const endDate = new Date(searchStart + "T00:00:00");
  if (!params.data) {
    endDate.setDate(endDate.getDate() + 60);
  }
  const searchEnd = params.data
    ? searchStart
    : endDate.toISOString().split("T")[0];

  const { data: slots, error } = await supabase
    .from("schedule_slots")
    .select("id, slot_date, slot_start, slot_end, slot_unit_minutes, status")
    .eq("status", "free")
    .eq("slot_unit_minutes", SLOT_BASE_MINUTES)
    .gte("slot_date", searchStart)
    .lte("slot_date", searchEnd)
    .order("slot_date", { ascending: true })
    .order("slot_start", { ascending: true });

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

  for (const [date, daySlots] of grouped) {
    if (date < searchStart) {
      continue;
    }

    const lookup = buildSlotLookup(daySlots);
    const sorted = daySlots
      .slice()
      .sort((a, b) => a.slot_start.localeCompare(b.slot_start));

    for (const slot of sorted) {
      if (sanitizedSlots.length >= limit) {
        break;
      }

      if (startAfter && date === startAfter.date && slot.slot_start <= startAfter.time) {
        continue;
      }

      if (date === today && currentTime && slot.slot_start <= currentTime) {
        continue;
      }

      const contiguous = findContiguousSlots(
        sorted,
        slot.slot_start,
        durationMinutes
      );

      if (!contiguous) {
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

  return {
    success: true,
    slots: sanitizedSlots,
    count: sanitizedSlots.length,
    duration_minutes: durationMinutes,
    search_type: params.data ? "specific_date" : "next_available",
  };
}

async function bookAppointment(params: {
  patient_id: string;
  slot_id?: string;
  slot_date?: string;
  slot_start?: string;
  duration_minutes?: number;
  rodzaj?: string;
  notatki?: string;
}) {
  const durationMinutes = params.duration_minutes || 30;
  if (!isValidDurationMinutes(durationMinutes)) {
    return {
      success: false,
      message: "Nieprawidłowa długość wizyty. Użyj wielokrotności 15 minut.",
    };
  }

  let slotQuery = supabase
    .from("schedule_slots")
    .select("id, slot_date, slot_start, slot_unit_minutes, status")
    .eq("status", "free")
    .eq("slot_unit_minutes", SLOT_BASE_MINUTES);

  if (params.slot_id) {
    slotQuery = slotQuery.eq("id", params.slot_id);
  } else if (params.slot_date && params.slot_start) {
    slotQuery = slotQuery
      .eq("slot_date", params.slot_date)
      .eq("slot_start", params.slot_start);
  } else {
    return {
      success: false,
      message: "Brakuje slot_id lub slot_date/slot_start",
    };
  }

  const { data: slot, error: checkError } = await slotQuery.single();

  if (checkError || !slot) {
    return {
      success: false,
      message: "Nie znaleziono wolnego slotu",
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

  const visitType = (params.rodzaj || "LECZENIE").trim();
  const notes = params.notatki?.trim() || "";

  const { data: newVisit, error: visitError } = await supabase
    .from("wizyty")
    .insert({
      pacjent_id: params.patient_id,
      data: slot.slot_date,
      godzina: slot.slot_start,
      godzina_od: slot.slot_start,
      godzina_do: slotEndTime,
      rodzaj: visitType,
      notatki: notes,
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

async function cancelAppointment(params: { appointment_id: string }) {
  if (!params.appointment_id) {
    return {
      success: false,
      message: "appointment_id jest wymagany",
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

async function updateAppointment(params: {
  appointment_id: string;
  pacjent_id?: string;
  rodzaj?: string;
  notatki?: string;
  status?: string;
}) {
  if (!params.appointment_id) {
    return {
      success: false,
      message: "appointment_id jest wymagany",
    };
  }

  const updatePayload: Record<string, any> = {};

  if (params.pacjent_id) {
    updatePayload.pacjent_id = params.pacjent_id;
  }
  if (params.rodzaj) {
    updatePayload.rodzaj = params.rodzaj.trim();
  }
  if (params.notatki !== undefined) {
    updatePayload.notatki = params.notatki;
  }
  if (params.status) {
    updatePayload.status = params.status;
  }

  if (Object.keys(updatePayload).length === 0) {
    return {
      success: false,
      message: "Brak danych do aktualizacji",
    };
  }

  const { error } = await supabase
    .from("wizyty")
    .update(updatePayload)
    .eq("id", params.appointment_id);

  if (error) {
    throw error;
  }

  return {
    success: true,
    message: "Wizyta zaktualizowana pomyślnie",
  };
}

async function rescheduleAppointment(params: {
  old_appointment_id: string;
  slot_id?: string;
  slot_date?: string;
  slot_start?: string;
  duration_minutes?: number;
  patient_id: string;
  rodzaj?: string;
  notatki?: string;
}) {
  const bookingResult = await bookAppointment({
    patient_id: params.patient_id,
    slot_id: params.slot_id,
    slot_date: params.slot_date,
    slot_start: params.slot_start,
    duration_minutes: params.duration_minutes,
    rodzaj: params.rodzaj,
    notatki: params.notatki,
  });

  if (!bookingResult.success) {
    return bookingResult;
  }

  const cancelResult = await cancelAppointment({
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body?.action || "";

    let result;
    switch (action) {
      case "get_available_slots":
        result = await getAvailableSlots(body);
        break;
      case "book":
        result = await bookAppointment(body);
        break;
      case "cancel":
        result = await cancelAppointment(body);
        break;
      case "update":
        result = await updateAppointment(body);
        break;
      case "reschedule":
        result = await rescheduleAppointment(body);
        break;
      default:
        result = {
          success: false,
          message: "Nieznana akcja",
        };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("manage-appointments error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error?.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
