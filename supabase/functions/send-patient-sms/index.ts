import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Wysyłanie SMS przez SMSAPI
async function sendSMS(telefon: string, tresc: string) {
  const smsapiToken = Deno.env.get("SMSAPI_TOKEN");

  if (!smsapiToken) {
    throw new Error("Brak skonfigurowanego SMSAPI_TOKEN");
  }

  const params = new URLSearchParams({
    to: telefon,
    message: tresc,
    format: "json",
  });

  const resp = await fetch(`https://api.smsapi.pl/sms.do?${params}`, {
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
  if (/^48[0-9]{9}$/.test(cleaned)) return cleaned;
  if (/^[0-9]{9}$/.test(cleaned)) return `48${cleaned}`;
  return null;
}

serve(async (req: Request) => {
  // Obsługa CORS preflight (OPTIONS request)
  if (req.method === "OPTIONS") {
    return new Response("ok", { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { pacjent_id, telefon, tresc } = await req.json();

    if (!pacjent_id || !telefon || !tresc) {
      return new Response(
        JSON.stringify({ error: "Brak wymaganych pól: pacjent_id, telefon, tresc" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (tresc.length > 160) {
      return new Response(
        JSON.stringify({ error: "SMS nie może być dłuższy niż 160 znaków" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalized = normalizePhone(telefon);
    if (!normalized) {
      return new Response(
        JSON.stringify({ error: "Nieprawidłowy numer telefonu" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Wysyłanie SMS
    const result = await sendSMS(normalized, tresc);

    // Zapis logu do sms_logs (opcjonalnie - nie blokujemy sukcesu jeśli SMS się wysłał)
    const currentDate = new Date();
    const dateStr = currentDate.toISOString().split('T')[0];
    const timeStr = currentDate.toTimeString().split(' ')[0];

    const { error: logError } = await supabase
      .from("sms_logs")
      .insert({
        pacjent_id,
        telefon: normalized,
        tresc,
        status: result.ok ? "SENT" : "FAILED",
        typ: "INNE",
        data_wizyty: dateStr,
        godzina: timeStr,
      });

    if (logError) {
      console.error("Database error (logowanie):", logError);
      // ❌ NIE RZUCAJ BŁĘDEM jeśli SMS się wysłał!
      // To tylko problem z logowaniem, nie z wysyłką
    }

    // ✅ Zawsze zwracaj sukces jeśli SMS wysłany, nawet jeśli logowanie się nie powiodło
    return new Response(
      JSON.stringify({
        status: result.ok ? "ok" : "error",
        message: result.ok ? "SMS wysłane pomyślnie" : "Błąd wysyłania SMS",
        response: result.body
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ 
        status: "error", 
        error: err instanceof Error ? err.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
