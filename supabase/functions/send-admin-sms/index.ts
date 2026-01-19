import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SMSAPI_URL = "https://api.smsapi.pl";

// Supabase client (używaj service role do wstawiania logów)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Wysyłanie SMS przez SMSAPI
async function sendSms(to: string, text: string): Promise<{ ok: boolean; body: any }> {
  const smsapiToken = Deno.env.get("SMSAPI_TOKEN");
  
  if (!smsapiToken) {
    throw new Error("Brak skonfigurowanego SMSAPI_TOKEN");
  }
  
  const params = new URLSearchParams({
    to: to,
    message: text,
    format: "json",
  });

  const resp = await fetch(`${SMSAPI_URL}/sms.do?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${smsapiToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const body = await resp.json();
  return { ok: resp.ok, body };
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
  // Obsługa preflight (CORS preflight requests)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("send-admin-sms called");
    const body = await req.json();
    console.log("Raw request body:", JSON.stringify(body));
    const { date, type, customText } = body;
    console.log("Parameters:", { date, type, customText });

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
          error: "Nieprawidłowy typ. Dozwolone: PRZYPOMNIENIE, ODWOLANIE, INNE",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Pobierz wizyty + pacjentów, filtrując tylko te o statusie 'zaplanowana'
    console.log("Fetching visits for date:", date);
    const { data: visits, error } = await supabase
      .from("wizyty")
      .select(`
        id,
        data,
        godzina,
        pacjenci!inner(id, telefon)
      `)
      .eq("data", date)
      .eq("status", "zaplanowana");

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Błąd pobierania wizyt z bazy danych",
          details: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log("Found visits:", visits?.length || 0);

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

    let sent = 0, failed = 0;
    const errors: string[] = [];

    for (const v of visits) {
      console.log("Processing visit:", v.id, "patient:", v.pacjenci?.id);
      const visitTime = formatTime(v.godzina);
      const patient = v.pacjenci;

      if (!patient || !patient.telefon) {
        console.log("No patient or phone for visit:", v.id, "patient:", patient);
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
Przypominamy o jutrzejszej wizycie.
Godzina: ${visitTime}
Visitella
Warszawa`;
      } else if (type === "ODWOLANIE") {
        text = `Z przykrością musimy odwołać Twoją wizytę w dniu ${v.data} o godzinie ${visitTime}. Prosimy o kontakt w celu ustalenia nowego terminu. Visitella, Warszawa`;
      } else {
        text = customText || "";
      }

      // Walidacja długości SMS (limit SMSAPI: 160 znaków)
      if (text.length > 160) {
        failed++;
        errors.push(`Wiadomość dla wizyty ${v.id} przekracza limit 160 znaków (${text.length} znaków)`);
        continue;
      }

      const result = await sendSms(normalized, text);

      // Szczegółowe logowanie odpowiedzi API dla diagnozy
      console.log(`SMS API response for ${normalized}:`, {
        ok: result.ok,
        status: result.body?.error?.code || 'unknown',
        message: result.body?.error?.message || result.body?.message || 'unknown',
        fullResponse: result.body
      });

      // Zapis logu do sms_logs (opcjonalnie - nie blokujemy sukcesu jeśli SMS się wysłał)
      const { error: logError } = await supabase.from("sms_logs").insert({
        wizyta_id: v.id,
        pacjent_id: patient.id,
        telefon: normalized,
        data_wizyty: v.data,
        godzina: v.godzina,
        typ: type,
        tresc: text,
        status: result.ok ? "SENT" : "FAILED",
      });

      if (logError) {
        console.error("Database error (logowanie):", logError);
        // ❌ NIE RZUCAJ BŁĘDEM jeśli SMS się wysłał!
        // To tylko problem z logowaniem, nie z wysyłką
      }

      if (result.ok) sent++;
      else {
        failed++;
        // Szczegółowe komunikaty błędów na podstawie odpowiedzi SMSAPI
        let errorMessage = `Błąd SMS dla ${normalized}`;
        if (result.body?.error) {
          const errorCode = result.body.error.code;
          const errorMsg = result.body.error.message;

          switch (errorCode) {
            case 11:
              errorMessage += ": Nieprawidłowy numer odbiorcy";
              break;
            case 12:
              errorMessage += ": Niewystarczające środki na koncie";
              break;
            case 13:
              errorMessage += ": Błąd autoryzacji - nieprawidłowy token";
              break;
            case 14:
              errorMessage += ": Nieprawidłowa długość wiadomości";
              break;
            case 17:
              errorMessage += ": Limit wysyłki przekroczony";
              break;
            case 18:
              errorMessage += ": Nieprawidłowy nadawca";
              break;
            case 101:
              errorMessage += ": Nieprawidłowe parametry żądania";
              break;
            default:
              errorMessage += `: ${errorMsg || 'Nieznany błąd API'}`;
          }
        } else {
          errorMessage += `: ${JSON.stringify(result.body) || 'Nieznany błąd'}`;
        }
        errors.push(errorMessage);
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
    console.error("Function error:", err);
    // Szczegółowe logowanie błędów dla diagnozy
    if (err instanceof Error) {
      console.error("Error name:", err.name);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
    } else {
      console.error("Non-Error exception:", typeof err, err);
    }
    return new Response(
      JSON.stringify({
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
        type: err instanceof Error ? err.name : typeof err,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
