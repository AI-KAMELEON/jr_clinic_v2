import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
serve(async ()=>{
  try {
    // Jutrzejsza data
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD
    console.log(`Wysyłanie przypomnień na datę: ${tomorrowStr}`);
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-admin-sms`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
        "apikey": Deno.env.get("SUPABASE_ANON_KEY")
      },
      body: JSON.stringify({
        date: tomorrowStr,
        type: "reminder" // ← ZMIANA: z "PRZYPOMNIENIE" na "reminder"
      })
    });
    if (!res.ok) {
      throw new Error(`Błąd wywołania send-admin-sms: ${res.status} ${res.statusText}`);
    }
    const result = await res.json();
    console.log(`Wysłano: ${result.sent}, Błędów: ${result.failed}`);
    return new Response(JSON.stringify({
      message: "Daily reminders sent",
      date: tomorrowStr,
      sent: result.sent,
      failed: result.failed
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error("Błąd w daily-reminder:", error.message);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
