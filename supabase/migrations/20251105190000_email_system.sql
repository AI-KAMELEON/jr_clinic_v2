-- Email System Migration
-- Creates tables for email accounts, logs, and inbox

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Create email_accounts table
CREATE TABLE IF NOT EXISTS "public"."email_accounts" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "administrator_id" uuid NOT NULL,
    "email_address" text NOT NULL,
    "provider" text NOT NULL,
    "auth_type" text NOT NULL,
    
    -- OAuth2 fields (encrypted in Vault)
    "oauth2_access_token_encrypted" text,
    "oauth2_refresh_token_encrypted" text,
    "oauth2_expires_at" timestamp with time zone,
    "oauth2_provider_id" text, -- 'gmail', 'outlook'
    
    -- SMTP fields (encrypted in Vault)
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

ALTER TABLE "public"."email_accounts" OWNER TO "postgres";

-- Create email_logs table
CREATE TABLE IF NOT EXISTS "public"."email_logs" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "email_account_id" uuid NOT NULL,
    "pacjent_id" uuid,
    "wizyta_id" uuid,
    "to" text NOT NULL,
    "cc" text[],
    "bcc" text[],
    "subject" text NOT NULL,
    "body_text" text,
    "body_html" text,
    "status" text NOT NULL,
    "error_message" text,
    "message_id" text,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    
    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_logs_status_check" CHECK (
        "status" = ANY (ARRAY['sent'::text, 'failed'::text, 'pending'::text])
    )
);

ALTER TABLE "public"."email_logs" OWNER TO "postgres";

-- Create email_inbox table (for received emails)
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

ALTER TABLE "public"."email_inbox" OWNER TO "postgres";

-- Add foreign keys
ALTER TABLE ONLY "public"."email_accounts"
    ADD CONSTRAINT "email_accounts_administrator_id_fkey" FOREIGN KEY ("administrator_id") 
    REFERENCES "public"."administrators"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_email_account_id_fkey" FOREIGN KEY ("email_account_id") 
    REFERENCES "public"."email_accounts"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_pacjent_id_fkey" FOREIGN KEY ("pacjent_id") 
    REFERENCES "public"."pacjenci"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."email_logs"
    ADD CONSTRAINT "email_logs_wizyta_id_fkey" FOREIGN KEY ("wizyta_id") 
    REFERENCES "public"."wizyty"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."email_inbox"
    ADD CONSTRAINT "email_inbox_email_account_id_fkey" FOREIGN KEY ("email_account_id") 
    REFERENCES "public"."email_accounts"("id") ON DELETE CASCADE;

-- Create indexes
CREATE INDEX "idx_email_accounts_administrator_id" ON "public"."email_accounts" USING btree ("administrator_id");
CREATE INDEX "idx_email_accounts_email_address" ON "public"."email_accounts" USING btree ("email_address");
CREATE INDEX "idx_email_logs_email_account_id" ON "public"."email_logs" USING btree ("email_account_id");
CREATE INDEX "idx_email_logs_pacjent_id" ON "public"."email_logs" USING btree ("pacjent_id");
CREATE INDEX "idx_email_logs_created_at" ON "public"."email_logs" USING btree ("created_at");
CREATE INDEX "idx_email_inbox_email_account_id" ON "public"."email_inbox" USING btree ("email_account_id");
CREATE INDEX "idx_email_inbox_received_at" ON "public"."email_inbox" USING btree ("received_at");

-- Enable RLS
ALTER TABLE "public"."email_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."email_logs" ENABLE ROW LEVEL SECURITY;
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

-- RLS Policies for email_logs
CREATE POLICY "Admins can read their email logs"
    ON "public"."email_logs"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM "public"."email_accounts"
            JOIN "public"."administrators" ON "administrators"."id" = "email_accounts"."administrator_id"
            WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
            AND "email_accounts"."id" = "email_logs"."email_account_id"
        )
    );

CREATE POLICY "Service role full access to email_logs"
    ON "public"."email_logs"
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

GRANT ALL ON TABLE "public"."email_logs" TO "service_role";
GRANT SELECT, INSERT, UPDATE ON TABLE "public"."email_logs" TO "authenticated";

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

CREATE TRIGGER trigger_update_email_accounts_updated_at
    BEFORE UPDATE ON "public"."email_accounts"
    FOR EACH ROW
    EXECUTE FUNCTION update_email_accounts_updated_at();





