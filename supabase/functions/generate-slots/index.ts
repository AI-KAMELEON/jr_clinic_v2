import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  addDays,
  addMinutes,
  format,
  isBefore,
  isAfter,
  parseISO,
} from "https://esm.sh/date-fns@3.6.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

interface WorkDay {
  dzien_tygodnia: string;
  godzina_od: string;
  godzina_do: string;
  aktywny: boolean;
  resource_id?: string | null;
}

interface Urlop {
  data_od: string;
  data_do: string;
  resource_id?: string | null;
}

interface Wizyta {
  data: string;
  godzina: string;
  godzina_do: string;
  status: string | null;
}

function normalizeWeekday(date: Date): string {
  const english = format(date, "EEEE").toLowerCase();
  const map: Record<string, string> = {
    monday: "poniedzialek",
    tuesday: "wtorek",
    wednesday: "sroda",
    thursday: "czwartek",
    friday: "piatek",
    saturday: "sobota",
    sunday: "niedziela",
  };
  return map[english] ?? english;
}

async function fetchPlanPracy(resourceId: string | null) {
  const query = supabase.from("plany_pracy").select("*");
  if (resourceId) {
    query.eq("resource_id", resourceId);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data as WorkDay[]) ?? [];
}

async function fetchUrlopy(
  startDate: string,
  endDate: string,
  resourceId: string | null
) {
  if (resourceId) {
    const { data, error } = await supabase
      .from("urlopy")
      .select("data_od, data_do, resource_id")
      .lte("data_od", endDate)
      .gte("data_do", startDate)
      .eq("resource_id", resourceId);

    if (!error) {
      return (data as Urlop[]) ?? [];
    }

    if (error.code !== "42703") {
      throw error;
    }
  }

  const { data, error } = await supabase
    .from("urlopy")
    .select("data_od, data_do")
    .lte("data_od", endDate)
    .gte("data_do", startDate);

  if (error) {
    throw error;
  }

  return (data as Urlop[]) ?? [];
}

async function fetchWizyty(startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from("wizyty")
    .select("data, godzina, godzina_do, status")
    .gte("data", startDate)
    .lte("data", endDate)
    .neq("status", "odwolana");

  if (error) {
    throw error;
  }
  return (data as Wizyta[]) ?? [];
}

function expandUrlopy(urlopy: Urlop[]) {
  const blockedDays = new Set<string>();
  for (const urlop of urlopy) {
    if (!urlop.data_od || !urlop.data_do) continue;
    let current = parseISO(urlop.data_od);
    const end = addDays(parseISO(urlop.data_do), 1);
    while (isBefore(current, end)) {
      blockedDays.add(format(current, "yyyy-MM-dd"));
      current = addDays(current, 1);
    }
  }
  return blockedDays;
}

function isSlotFree(
  slotStart: Date,
  slotEnd: Date,
  wizyty: Wizyta[],
  dateStr: string
): boolean {
  const dayVisits = wizyty.filter(w => w.data === dateStr);
  
  for (const visit of dayVisits) {
    const visitStart = parseISO(`${dateStr}T${visit.godzina}`);
    const visitEnd = visit.godzina_do 
      ? parseISO(`${dateStr}T${visit.godzina_do}`) 
      : addMinutes(visitStart, 15); 
    
    if (isBefore(slotStart, visitEnd) && isAfter(slotEnd, visitStart)) {
      return false;
    }
  }
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    const startDate: string = body.start_date ?? format(new Date(), "yyyy-MM-dd");
    const endDate: string =
      body.end_date ?? format(addDays(new Date(), 180), "yyyy-MM-dd");
    const resourceId: string | null = body.resource_id ?? null;
    
    const stepMinutes = 15;

    const planPracy = await fetchPlanPracy(resourceId);
    const planByDay = new Map(
      planPracy.map((p) => [p.dzien_tygodnia.toLowerCase(), p]),
    );

    const urlopy = await fetchUrlopy(startDate, endDate, resourceId);
    const blockedDays = expandUrlopy(urlopy);

    const wizyty = await fetchWizyty(startDate, endDate);

    let currentDate = parseISO(startDate);
    const endDateExclusive = addDays(parseISO(endDate), 1);

    const insertPayload: any[] = [];
    let count15 = 0;
    let count30 = 0;

    while (isBefore(currentDate, endDateExclusive)) {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const dayPlan = planByDay.get(normalizeWeekday(currentDate));

      if (dayPlan?.aktywny && !blockedDays.has(dateStr)) {
        let slotStart = parseISO(`${dateStr}T${dayPlan.godzina_od}`);
        const slotEndLimit = parseISO(`${dateStr}T${dayPlan.godzina_do}`);

        while (isBefore(slotStart, slotEndLimit)) {
          // Generate 15-min slot
          const end15 = addMinutes(slotStart, 15);
          if (!isAfter(end15, slotEndLimit)) {
             if (isSlotFree(slotStart, end15, wizyty, dateStr)) {
                insertPayload.push({
                  resource_id: resourceId ?? null,
                  slot_date: dateStr,
                  slot_start: format(slotStart, "HH:mm:ss"),
                  slot_end: format(end15, "HH:mm:ss"),
                  slot_unit_minutes: 15,
                  status: "free",
                  metadata: {},
                });
                count15++;
             }
          }

          // Generate 30-min slot
          const end30 = addMinutes(slotStart, 30);
          if (!isAfter(end30, slotEndLimit)) {
             if (isSlotFree(slotStart, end30, wizyty, dateStr)) {
                insertPayload.push({
                  resource_id: resourceId ?? null,
                  slot_date: dateStr,
                  slot_start: format(slotStart, "HH:mm:ss"),
                  slot_end: format(end30, "HH:mm:ss"),
                  slot_unit_minutes: 30,
                  status: "free",
                  metadata: {},
                });
                count30++;
             }
          }
          
          slotStart = addMinutes(slotStart, stepMinutes);
        }
      }

      currentDate = addDays(currentDate, 1);
    }

    console.log(`Generated ${count15} 15-min slots and ${count30} 30-min slots`);

    const deleteQuery = supabase
      .from("schedule_slots")
      .delete()
      .eq("status", "free")
      .gte("slot_date", startDate)
      .lte("slot_date", endDate);

    if (resourceId) {
      deleteQuery.eq("resource_id", resourceId);
    }

    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      throw deleteError;
    }

    if (insertPayload.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < insertPayload.length; i += chunkSize) {
        const chunk = insertPayload.slice(i, i + chunkSize);
        const { error: insertErr } = await supabase
          .from("schedule_slots")
          .insert(chunk);
        if (insertErr) {
          console.error("Insert error chunk", i, insertErr);
          throw insertErr;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertPayload.length,
        count15,
        count30,
        start_date: startDate,
        end_date: endDate,
        resource_id: resourceId ?? "default",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error: any) {
    console.error("generate-slots error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message ?? String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
