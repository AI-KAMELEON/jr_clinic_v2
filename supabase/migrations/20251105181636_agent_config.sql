-- Create agent_config table for voice agent configuration
CREATE TABLE IF NOT EXISTS "public"."agent_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "elevenlabs_agent_id" "text" NOT NULL,
    "twilio_phone_number" "text" NOT NULL,
    "agent_greeting" "text" DEFAULT 'Dzień dobry! Jak mogę pomóc?'::text,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."agent_config" OWNER TO "postgres";

-- Add primary key
ALTER TABLE ONLY "public"."agent_config"
    ADD CONSTRAINT "agent_config_pkey" PRIMARY KEY ("id");

-- Add unique constraint to ensure only one configuration exists
CREATE UNIQUE INDEX "idx_agent_config_unique" ON "public"."agent_config" USING "btree" ("id");

-- Enable RLS
ALTER TABLE "public"."agent_config" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can read agent config
CREATE POLICY "Admins can read agent config" ON "public"."agent_config"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."administrators"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
        )
    );

-- RLS Policy: Admins can insert agent config
CREATE POLICY "Admins can insert agent config" ON "public"."agent_config"
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM "public"."administrators"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
        )
    );

-- RLS Policy: Admins can update agent config
CREATE POLICY "Admins can update agent config" ON "public"."agent_config"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."administrators"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
        )
    );

-- Service role full access (for Edge Functions)
CREATE POLICY "Service role full access to agent_config" ON "public"."agent_config"
    TO "service_role"
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE "public"."agent_config" TO "service_role";
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."agent_config" TO "authenticated";

-- Create phone_conversations table for logging voice agent conversations
CREATE TABLE IF NOT EXISTS "public"."phone_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "text" NOT NULL,
    "agent_id" "text" NOT NULL,
    "phone_number" "text",
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "duration_seconds" integer,
    "transcript" "text",
    "status" "text" DEFAULT 'active'::text,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "phone_conversations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'failed'::"text"])))
);

ALTER TABLE "public"."phone_conversations" OWNER TO "postgres";

-- Add primary key
ALTER TABLE ONLY "public"."phone_conversations"
    ADD CONSTRAINT "phone_conversations_pkey" PRIMARY KEY ("id");

-- Add unique constraint on conversation_id
CREATE UNIQUE INDEX "idx_phone_conversations_conversation_id" ON "public"."phone_conversations" USING "btree" ("conversation_id");

-- Enable RLS
ALTER TABLE "public"."phone_conversations" ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can read phone conversations
CREATE POLICY "Admins can read phone conversations" ON "public"."phone_conversations"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."administrators"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
        )
    );

-- Service role full access (for Edge Functions)
CREATE POLICY "Service role full access to phone_conversations" ON "public"."phone_conversations"
    TO "service_role"
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE "public"."phone_conversations" TO "service_role";
GRANT SELECT ON TABLE "public"."phone_conversations" TO "authenticated";;
