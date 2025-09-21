import { serve } from "https://deno.land/std@0.181.0/http/server.ts";

serve(async () => {
  const now = new Date().toISOString();
  console.log(`🔔 CRON TEST TRIGGERED at ${now}`);

  return new Response(
    JSON.stringify({ message: "cron test", timestamp: now }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});