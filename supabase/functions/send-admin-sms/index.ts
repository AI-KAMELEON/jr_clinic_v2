import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const PLAY_API_URL = "https://uslugidlafirm.play.pl";

// Stałe z ENV
const clientId = Deno.env.get("CLIENT_ID");
const clientSecret = Deno.env.get("CLIENT_SECRET");
const from = Deno.env.get("SMS_FROM_NUMBER");

// Supabase client (używaj service role do wstawiania logów)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Token Play
async function getAccessToken(): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(`${PLAY_API_URL}/oauth/token-jwt`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const errorMsg = await resp.text();
    throw new Error(
      `Błąd przy pobieraniu tokena: ${resp.status} ${resp.statusText} → ${errorMsg}`
    );
  }

  const data = await resp.json();
  return data.access_token;
}

// Wysyłanie SMS Play
async function sendSms(
  token: string,
  to: string[],
  text: string
): Promise<{ ok: boolean; body: string }> {
  const resp = await fetch(`${PLAY_API_URL}/api/bramkasms/sendSms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      text,
      to,
    }),
  });

  const body = await resp.text();
  return {
    ok: resp.ok,
    body,
  };
}

// Normalizacja numeru do MSISDN (format: 48XXXXXXXXX)
function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/\s/g, "");
  if (/^48[0-9]{9}$/.test(cleaned)) return cleaned; // już ma prefix 48
  if (/^[0-9]{9}$/.test(cleaned)) return `48${cleaned}`; // dopisz prefix
  return null;
}

// Formatowanie godziny HH:MM (obcina sekundy)
function formatTime(time: string): string {
  return time.slice(0, 5);
}

serve(async (req: Request) => {
  // 👇 Obsługa preflight (CORS preflight requests)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { date, type, customText } = await req.json();

    if (!date || !type) {
      return new Response(
        JSON.stringify({
          error: "Brak wymaganych parametrów: date, type",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Walidacja typu
    const validTypes = ["PRZYPOMNIENIE", "ODWOLANIE", "INNE"];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({
          error:
            "Nieprawidłowy typ. Dozwolone: PRZYPOMNIENIE, ODWOLANIE, INNE",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!clientId || !clientSecret || !from) {
      throw new Error(
        "Brak wymaganych secrets: CLIENT_ID, CLIENT_SECRET, SMS_FROM_NUMBER"
      );
    }

    // Pobierz wizyty + pacjentów, filtrując tylko te o statusie 'zaplanowana'
    const { data: visits, error } = await supabase
      .from("wizyty")
      .select("id, data, godzina, pacjenci(id, telefon)")
      .eq("data", date)
      .eq("status", "zaplanowana"); // <-- KLUCZOWA ZMIANA

    if (error) throw error;

    if (!visits || visits.length === 0) {
      return new Response(
        JSON.stringify({
          status: "ok",
          message: "Brak wizyt na datę",
          sent: 0,
          failed: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = await getAccessToken();
    let sent = 0,
      failed = 0;
    const errors: string[] = [];

    for (const v of visits) {
      const visitTime = formatTime(v.godzina);
      const patient = v.pacjenci;

      if (!patient || !patient.telefon) {
        failed++;
        errors.push(`Brak telefonu dla wizyty ${v.id}`);
        continue;
      }

      const normalized = normalizePhone(patient.telefon);
      if (!normalized) {
        failed++;
        errors.push(`Nieprawidłowy numer: ${patient.telefon}`);
        continue;
      }

      let text: string;
      if (type === "PRZYPOMNIENIE") {
        text = `Dzień dobry,
Przypominamy o jutrzejszej wizycie,
Godzina: ${visitTime},
JR Clinic,
Rynek 7,
Maków Mazowiecki`;
      } else if (type === "ODWOLANIE") {
        text = `Z przykrością musimy odwołać Twoją wizytę w naszej klinice w dniu ${v.data} o godzinie ${visitTime}. Prosimy o kontakt w celu ustalenia nowego terminu.`;
      } else {
        text = customText || "";
      }

      const result = await sendSms(token, [normalized], text);

      await supabase.from("sms_logs").insert({
        wizyta_id: v.id,
        pacjent_id: patient.id,
        telefon: normalized,
        data_wizyty: v.data,
        godzina: v.godzina,
        typ: type,
        tresc: text,
        status: result.ok ? "SENT" : "FAILED",
      });

      if (result.ok) sent++;
      else {
        failed++;
        errors.push(`Błąd SMS dla ${normalized}: ${result.body}`);
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        sent,
        failed,
        total: visits.length,
        errors: errors.length ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
