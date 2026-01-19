-- Create email_accounts table
CREATE TABLE IF NOT EXISTS "public"."email_accounts" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "administrator_id" uuid NOT NULL,
    "email_address" text NOT NULL,
    "provider" text NOT NULL,
    "auth_type" text NOT NULL,
    "oauth2_access_token_encrypted" text,
    "oauth2_refresh_token_encrypted" text,
    "oauth2_expires_at" timestamp with time zone,
    "oauth2_provider_id" text,
    "smtp_host" text,
    "smtp_port" integer,
    "smtp_secure" boolean DEFAULT false,
    "smtp_username" text,
    "smtp_password_encrypted" text,
    "is_active" boolean DEFAULT true,
    "display_name" text,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_accounts_provider_check" CHECK (
        "provider" = ANY (ARRAY['gmail'::text, 'outlook'::text, 'custom_smtp'::text])
    ),
    CONSTRAINT "email_accounts_auth_type_check" CHECK (
        "auth_type" = ANY (ARRAY['oauth2'::text, 'smtp'::text])
    )
);

-- Create email_inbox table
CREATE TABLE IF NOT EXISTS "public"."email_inbox" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "email_account_id" uuid NOT NULL,
    "message_id" text NOT NULL,
    "from_email" text NOT NULL,
    "from_name" text,
    "to" text[] NOT NULL,
    "cc" text[],
    "bcc" text[],
    "subject" text,
    "body_text" text,
    "body_html" text,
    "received_at" timestamp with time zone NOT NULL,
    "is_read" boolean DEFAULT false,
    "is_archived" boolean DEFAULT false,
    "has_attachments" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT now(),
    CONSTRAINT "email_inbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_inbox_message_id_unique" UNIQUE ("email_account_id", "message_id")
);

-- Add foreign keys
ALTER TABLE ONLY "public"."email_accounts"
    ADD CONSTRAINT "email_accounts_administrator_id_fkey" FOREIGN KEY ("administrator_id") 
    REFERENCES "public"."administrators"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."email_inbox"
    ADD CONSTRAINT "email_inbox_email_account_id_fkey" FOREIGN KEY ("email_account_id") 
    REFERENCES "public"."email_accounts"("id") ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS "idx_email_accounts_administrator_id" ON "public"."email_accounts" USING btree ("administrator_id");
CREATE INDEX IF NOT EXISTS "idx_email_accounts_email_address" ON "public"."email_accounts" USING btree ("email_address");
CREATE INDEX IF NOT EXISTS "idx_email_inbox_email_account_id" ON "public"."email_inbox" USING btree ("email_account_id");
CREATE INDEX IF NOT EXISTS "idx_email_inbox_received_at" ON "public"."email_inbox" USING btree ("received_at");

-- Enable RLS
ALTER TABLE "public"."email_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_inbox" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_accounts
CREATE POLICY "Admins can manage their own email accounts"
    ON "public"."email_accounts"
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."administrators"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
            AND "administrators"."id" = "email_accounts"."administrator_id"
        )
    );

CREATE POLICY "Service role full access to email_accounts"
    ON "public"."email_accounts"
    TO "service_role"
    USING (true)
    WITH CHECK (true);

-- RLS Policies for email_inbox
CREATE POLICY "Admins can read their inbox"
    ON "public"."email_inbox"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."email_accounts"
            JOIN "public"."administrators" ON "administrators"."id" = "email_accounts"."administrator_id"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
            AND "email_accounts"."id" = "email_inbox"."email_account_id"
        )
    );

CREATE POLICY "Admins can update their inbox"
    ON "public"."email_inbox"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."email_accounts"
            JOIN "public"."administrators" ON "administrators"."id" = "email_accounts"."administrator_id"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
            AND "email_accounts"."id" = "email_inbox"."email_account_id"
        )
    );

CREATE POLICY "Service role full access to email_inbox"
    ON "public"."email_inbox"
    TO "service_role"
    USING (true)
    WITH CHECK (true);

-- Grant permissions
GRANT ALL ON TABLE "public"."email_accounts" TO "service_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."email_accounts" TO "authenticated";

GRANT ALL ON TABLE "public"."email_inbox" TO "service_role";
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."email_inbox" TO "authenticated";

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_email_accounts_updated_at ON "public"."email_accounts";
CREATE TRIGGER trigger_update_email_accounts_updated_at
    BEFORE UPDATE ON "public"."email_accounts"
    FOR EACH ROW
    EXECUTE FUNCTION update_email_accounts_updated_at();;
