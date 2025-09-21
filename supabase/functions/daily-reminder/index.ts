import { serve } from "https://deno.land/std@0.181.0/http/server.ts";

serve(async () => {
  const now = new Date().toISOString();
  console.log(`🔔 daily-reminder TRIGGERED at ${now}`);

  try {
    // 📅 oblicz jutrzejszą datę
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD

    console.log(`📅 Generuję przypomnienia na datę: ${tomorrowStr}`);

    // 🔑 endpoint docelowy
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-admin-sms`;

    const payload = {
      date: tomorrowStr,
      type: "reminder", // tu ważne: musi być zgodne z tym, co obsługuje send-admin-sms
    };

    console.log("➡️ Wywołuję send-admin-sms", url, "z body:", payload);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
        apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
      },
      body: JSON.stringify(payload),
    });

    console.log("➡️ Odpowiedź send-admin-sms:", res.status, res.statusText);

    let result: any;
    try {
      result = await res.json();
    } catch (jsonErr) {
      console.error("⚠️ Nie udało się sparsować JSON w odpowiedzi:", jsonErr.message);
      throw jsonErr;
    }

    console.log(`✅ Wynik: wysłano=${result.sent}, błędów=${result.failed}`);

    return new Response(
      JSON.stringify({
        message: "Daily reminders sent",
        date: tomorrowStr,
        sent: result.sent,
        failed: result.failed,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Błąd w daily-reminder:", error.message);

    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});