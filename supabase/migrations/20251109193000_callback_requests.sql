-- Callback requests table for general callback workflow with reason metadata
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE TABLE IF NOT EXISTS "public"."callback_requests" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "patient_id" uuid,
    "phone" text NOT NULL,
    "patient_name" text,
    "reason" text NOT NULL,
    "message" text,
    "status" text NOT NULL DEFAULT 'pending',
    "priority" text NOT NULL DEFAULT 'normal',
    "callback_date" date NOT NULL DEFAULT CURRENT_DATE,
    "preferred_time" text,
    "requested_at" timestamp with time zone NOT NULL DEFAULT now(),
    "last_attempt_at" timestamp with time zone,
    "attempt_count" integer NOT NULL DEFAULT 0,
    "assigned_admin_id" uuid,
    "completed_at" timestamp with time zone,
    "rollover_count" integer NOT NULL DEFAULT 0,
    "created_via" text NOT NULL DEFAULT 'agent',
    "conversation_id" uuid,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "callback_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "callback_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'expired'::text])),
    CONSTRAINT "callback_requests_priority_check" CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])),
    CONSTRAINT "callback_requests_created_via_check" CHECK (created_via = ANY (ARRAY['agent'::text, 'admin'::text, 'system'::text])),
    CONSTRAINT "callback_requests_reason_length" CHECK (char_length(reason) <= 160)
);

ALTER TABLE "public"."callback_requests" OWNER TO "postgres";

ALTER TABLE ONLY "public"."callback_requests"
    ADD CONSTRAINT "callback_requests_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "public"."pacjenci"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."callback_requests"
    ADD CONSTRAINT "callback_requests_assigned_admin_id_fkey"
    FOREIGN KEY ("assigned_admin_id") REFERENCES "public"."administrators"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."callback_requests"
    ADD CONSTRAINT "callback_requests_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "public"."phone_conversations"("id") ON DELETE SET NULL;

COMMENT ON TABLE "public"."callback_requests" IS 'Prośby o oddzwonienie tworzone przez agenta głosowego lub administratorów.';
COMMENT ON COLUMN "public"."callback_requests"."reason" IS 'Krótkie streszczenie powodu prośby o kontakt (max 160 znaków).';
COMMENT ON COLUMN "public"."callback_requests"."message" IS 'Szczegółowa notatka przekazana przez rozmówcę.';
COMMENT ON COLUMN "public"."callback_requests"."callback_date" IS 'Dzień, w którym należy wykonać oddzwonienie.';
COMMENT ON COLUMN "public"."callback_requests"."preferred_time" IS 'Preferowana pora kontaktu (np. rano, po południu).';

CREATE INDEX IF NOT EXISTS "idx_callback_requests_status_date"
    ON "public"."callback_requests" USING btree ("status", "callback_date");

CREATE INDEX IF NOT EXISTS "idx_callback_requests_assigned_admin"
    ON "public"."callback_requests" USING btree ("assigned_admin_id");

CREATE INDEX IF NOT EXISTS "idx_callback_requests_patient_id"
    ON "public"."callback_requests" USING btree ("patient_id");

ALTER TABLE "public"."callback_requests" ENABLE ROW LEVEL SECURITY;

-- Administrators (authenticated) can see callback requests
CREATE POLICY "Admins can select callback requests" ON "public"."callback_requests"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."administrators"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
        )
    );

-- Administrators can insert callback requests (e.g. manual entries)
CREATE POLICY "Admins can insert callback requests" ON "public"."callback_requests"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM "public"."administrators"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
        )
    );

-- Administrators can update callback requests (workflow)
CREATE POLICY "Admins can update callback requests" ON "public"."callback_requests"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."administrators"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM "public"."administrators"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
        )
    );

-- Service role (Edge Functions) full access
CREATE POLICY "Service role full access to callback_requests" ON "public"."callback_requests"
    TO "service_role"
    USING (true)
    WITH CHECK (true);

GRANT ALL ON TABLE "public"."callback_requests" TO "service_role";
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."callback_requests" TO "authenticated";









