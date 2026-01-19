-- Ensure at least one agent configuration exists for webhook requests.
INSERT INTO "public"."agent_config" (
    "elevenlabs_agent_id",
    "twilio_phone_number"
)
SELECT
    'pending-setup' AS "elevenlabs_agent_id",
    '+10000000000' AS "twilio_phone_number"
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."agent_config"
);
;
