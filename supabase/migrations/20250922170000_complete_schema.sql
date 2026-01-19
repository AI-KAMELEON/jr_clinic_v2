

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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."administrators" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."administrators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cron_logs" (
    "id" bigint NOT NULL,
    "name" "text",
    "ts" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cron_logs" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cron_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cron_logs_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cron_logs_id_seq" OWNED BY "public"."cron_logs"."id";



CREATE TABLE IF NOT EXISTS "public"."pacjenci" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "imie" "text" NOT NULL,
    "nazwisko" "text" NOT NULL,
    "telefon" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "notatki" "text" DEFAULT ''::"text",
    "adres" "text",
    "data_urodzenia" "date",
    "email" "text",
    "pesel" "text",
    "brak_pesel" boolean DEFAULT false,
    CONSTRAINT "check_pesel_format" CHECK ((("pesel" IS NULL) OR (("length"("pesel") = 11) AND ("pesel" ~ '^[0-9]+$'::"text")))),
    CONSTRAINT "check_pesel_or_brak_pesel" CHECK ((("pesel" IS NOT NULL) OR ("brak_pesel" = true)))
);


ALTER TABLE "public"."pacjenci" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plany_pracy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dzien_tygodnia" "text" NOT NULL,
    "aktywny" boolean DEFAULT true NOT NULL,
    "godzina_od" time without time zone NOT NULL,
    "godzina_do" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_work_hours" CHECK (("godzina_do" > "godzina_od")),
    CONSTRAINT "plany_pracy_dzien_tygodnia_check" CHECK (("dzien_tygodnia" = ANY (ARRAY['poniedzialek'::"text", 'wtorek'::"text", 'sroda'::"text", 'czwartek'::"text", 'piatek'::"text", 'sobota'::"text", 'niedziela'::"text"])))
);


ALTER TABLE "public"."plany_pracy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wizyta_id" "uuid",
    "pacjent_id" "uuid",
    "telefon" "text" NOT NULL,
    "data_wizyty" "date" NOT NULL,
    "godzina" time without time zone NOT NULL,
    "typ" "text",
    "tresc" "text",
    "status" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "sms_logs_status_check" CHECK (("status" = ANY (ARRAY['SENT'::"text", 'FAILED'::"text"]))),
    CONSTRAINT "sms_logs_typ_check" CHECK (("typ" = ANY (ARRAY['PRZYPOMNIENIE'::"text", 'ODWOLANIE'::"text", 'INNE'::"text"])))
);


ALTER TABLE "public"."sms_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wizyty" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pacjent_id" "uuid",
    "data" "date" NOT NULL,
    "godzina" time without time zone NOT NULL,
    "rodzaj" "text" NOT NULL,
    "notatki" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "opis_wizyty" "text",
    "wykonane_zabiegi" "text",
    "status" "text" DEFAULT 'zaplanowana'::"text",
    "godzina_od" time without time zone NOT NULL,
    "godzina_do" time without time zone NOT NULL,
    CONSTRAINT "check_visit_duration" CHECK (("godzina_do" > "godzina_od")),
    CONSTRAINT "wizyty_status_check" CHECK (("status" = ANY (ARRAY['zaplanowana'::"text", 'wykonana'::"text", 'odwolana'::"text"])))
);


ALTER TABLE "public"."wizyty" OWNER TO "postgres";


COMMENT ON COLUMN "public"."wizyty"."godzina" IS 'Legacy field - kept for backward compatibility, represents start time';



COMMENT ON COLUMN "public"."wizyty"."godzina_od" IS 'Start time of the visit';



COMMENT ON COLUMN "public"."wizyty"."godzina_do" IS 'End time of the visit';



CREATE OR REPLACE VIEW "public"."sms_logs_view" AS
 SELECT "l"."id" AS "log_id",
    "l"."created_at",
    "l"."typ",
    "l"."status",
    "l"."tresc",
    "l"."data_wizyty",
    "l"."godzina",
    "p"."imie",
    "p"."nazwisko",
    "l"."telefon",
    "w"."rodzaj"
   FROM (("public"."sms_logs" "l"
     LEFT JOIN "public"."pacjenci" "p" ON (("p"."id" = "l"."pacjent_id")))
     LEFT JOIN "public"."wizyty" "w" ON (("w"."id" = "l"."wizyta_id")));


ALTER VIEW "public"."sms_logs_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."urlopy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data_od" "date" NOT NULL,
    "data_do" "date" NOT NULL,
    "opis" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_vacation_dates" CHECK (("data_do" >= "data_od"))
);


ALTER TABLE "public"."urlopy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wizyty_backup" (
    "id" "uuid",
    "pacjent_id" "uuid",
    "data" "date",
    "godzina" time without time zone,
    "rodzaj" "text",
    "notatki" "text",
    "created_at" timestamp with time zone,
    "opis_wizyty" "text",
    "wykonane_zabiegi" "text",
    "status" "text",
    "godzina_od" time without time zone,
    "godzina_do" time without time zone
);


ALTER TABLE "public"."wizyty_backup" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wizyty_pacjenci_view" AS
 SELECT "w"."id" AS "wizyta_id",
    "w"."data",
    "w"."godzina",
    "w"."rodzaj",
    "p"."id" AS "pacjent_id",
    "p"."imie",
    "p"."nazwisko",
    "p"."telefon"
   FROM ("public"."wizyty" "w"
     JOIN "public"."pacjenci" "p" ON (("p"."id" = "w"."pacjent_id")));


ALTER VIEW "public"."wizyty_pacjenci_view" OWNER TO "postgres";


-- Create daily notes table
CREATE TABLE IF NOT EXISTS "public"."notatki_dzienne" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data" "date" NOT NULL,
    "tresc" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notatki_dzienne" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cron_logs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cron_logs_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."administrators"
    ADD CONSTRAINT "administrators_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."administrators"
    ADD CONSTRAINT "administrators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cron_logs"
    ADD CONSTRAINT "cron_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pacjenci"
    ADD CONSTRAINT "pacjenci_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plany_pracy"
    ADD CONSTRAINT "plany_pracy_dzien_tygodnia_key" UNIQUE ("dzien_tygodnia");



ALTER TABLE ONLY "public"."plany_pracy"
    ADD CONSTRAINT "plany_pracy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."urlopy"
    ADD CONSTRAINT "urlopy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wizyty"
    ADD CONSTRAINT "wizyty_pkey" PRIMARY KEY ("id");



-- Add primary key for notatki_dzienne
ALTER TABLE ONLY "public"."notatki_dzienne"
    ADD CONSTRAINT "notatki_dzienne_pkey" PRIMARY KEY ("id");



-- Add unique constraint on date (one note per day)
ALTER TABLE ONLY "public"."notatki_dzienne"
    ADD CONSTRAINT "notatki_dzienne_data_key" UNIQUE ("data");



CREATE UNIQUE INDEX "idx_pacjenci_pesel_unique" ON "public"."pacjenci" USING "btree" ("pesel") WHERE ("pesel" IS NOT NULL);



CREATE INDEX "idx_plany_pracy_dzien" ON "public"."plany_pracy" USING "btree" ("dzien_tygodnia");



CREATE INDEX "idx_urlopy_dates" ON "public"."urlopy" USING "btree" ("data_od", "data_do");



CREATE INDEX "idx_wizyty_status" ON "public"."wizyty" USING "btree" ("status");



CREATE INDEX "idx_wizyty_time_range" ON "public"."wizyty" USING "btree" ("data", "godzina_od", "godzina_do");



-- Add index for faster date lookups on notatki_dzienne
CREATE INDEX "idx_notatki_dzienne_data" ON "public"."notatki_dzienne" USING "btree" ("data");



CREATE UNIQUE INDEX "wizyty_data_godzina_active_unique" ON "public"."wizyty" USING "btree" ("data", "godzina") WHERE (("status" <> 'odwolana'::"text") OR ("status" IS NULL));



-- Add constraint to prevent empty notes
ALTER TABLE "public"."notatki_dzienne"
    ADD CONSTRAINT "check_notatka_not_empty" CHECK (length(trim("tresc")) > 0);



ALTER TABLE ONLY "public"."administrators"
    ADD CONSTRAINT "administrators_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_pacjent_id_fkey" FOREIGN KEY ("pacjent_id") REFERENCES "public"."pacjenci"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_wizyta_id_fkey" FOREIGN KEY ("wizyta_id") REFERENCES "public"."wizyty"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wizyty"
    ADD CONSTRAINT "wizyty_pacjent_id_fkey" FOREIGN KEY ("pacjent_id") REFERENCES "public"."pacjenci"("id") ON DELETE CASCADE;



CREATE POLICY "Allow all operations for authenticated users" ON "public"."plany_pracy" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow all operations for authenticated users" ON "public"."urlopy" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow delete for authenticated users" ON "public"."sms_logs" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow insert for authenticated users" ON "public"."sms_logs" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow read for authenticated users" ON "public"."sms_logs" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow update for authenticated users" ON "public"."sms_logs" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Pacjenci full access for administrators" ON "public"."pacjenci" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."administrators"
  WHERE ("administrators"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "Urlopy full access for administrators" ON "public"."urlopy" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."administrators"
  WHERE ("administrators"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "Wizyty full access for administrators" ON "public"."wizyty" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."administrators"
  WHERE ("administrators"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



-- Create RLS policy for notatki_dzienne
CREATE POLICY "Notatki full access for administrators" 
ON "public"."notatki_dzienne" 
TO "authenticated" 
USING (
    EXISTS (
        SELECT 1
        FROM "public"."administrators"
        WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
    )
);



CREATE POLICY "admin_delete_policy" ON "public"."administrators" FOR DELETE USING (true);



CREATE POLICY "admin_insert_policy" ON "public"."administrators" FOR INSERT WITH CHECK (true);



CREATE POLICY "admin_select_policy" ON "public"."administrators" FOR SELECT USING (true);



CREATE POLICY "admin_update_policy" ON "public"."administrators" FOR UPDATE USING (true);



ALTER TABLE "public"."administrators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cron_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pacjenci" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."urlopy" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wizyty" ENABLE ROW LEVEL SECURITY;


-- Enable Row Level Security for notatki_dzienne
ALTER TABLE "public"."notatki_dzienne" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."pacjenci";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."plany_pracy";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."sms_logs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."urlopy";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."wizyty";



-- Add notatki_dzienne to realtime publication
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notatki_dzienne";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
































GRANT ALL ON TABLE "public"."administrators" TO "anon";
GRANT ALL ON TABLE "public"."administrators" TO "authenticated";
GRANT ALL ON TABLE "public"."administrators" TO "service_role";



GRANT ALL ON TABLE "public"."cron_logs" TO "anon";
GRANT ALL ON TABLE "public"."cron_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."cron_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cron_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cron_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cron_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pacjenci" TO "anon";
GRANT ALL ON TABLE "public"."pacjenci" TO "authenticated";
GRANT ALL ON TABLE "public"."pacjenci" TO "service_role";



GRANT ALL ON TABLE "public"."plany_pracy" TO "anon";
GRANT ALL ON TABLE "public"."plany_pracy" TO "authenticated";
GRANT ALL ON TABLE "public"."plany_pracy" TO "service_role";



GRANT ALL ON TABLE "public"."sms_logs" TO "anon";
GRANT ALL ON TABLE "public"."sms_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_logs" TO "service_role";



GRANT ALL ON TABLE "public"."wizyty" TO "anon";
GRANT ALL ON TABLE "public"."wizyty" TO "authenticated";
GRANT ALL ON TABLE "public"."wizyty" TO "service_role";



GRANT ALL ON TABLE "public"."sms_logs_view" TO "anon";
GRANT ALL ON TABLE "public"."sms_logs_view" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_logs_view" TO "service_role";



GRANT ALL ON TABLE "public"."urlopy" TO "anon";
GRANT ALL ON TABLE "public"."urlopy" TO "authenticated";
GRANT ALL ON TABLE "public"."urlopy" TO "service_role";



GRANT ALL ON TABLE "public"."wizyty_backup" TO "anon";
GRANT ALL ON TABLE "public"."wizyty_backup" TO "authenticated";
GRANT ALL ON TABLE "public"."wizyty_backup" TO "service_role";



GRANT ALL ON TABLE "public"."wizyty_pacjenci_view" TO "anon";
GRANT ALL ON TABLE "public"."wizyty_pacjenci_view" TO "authenticated";
GRANT ALL ON TABLE "public"."wizyty_pacjenci_view" TO "service_role";



-- Grant permissions for notatki_dzienne
GRANT ALL ON TABLE "public"."notatki_dzienne" TO "anon";
GRANT ALL ON TABLE "public"."notatki_dzienne" TO "authenticated";
GRANT ALL ON TABLE "public"."notatki_dzienne" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";

















-- Create trigger function to auto-update updated_at for notatki_dzienne
CREATE OR REPLACE FUNCTION update_notatki_dzienne_updated_at()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_notatki_dzienne_updated_at
    BEFORE UPDATE ON "public"."notatki_dzienne"
    FOR EACH ROW
    EXECUTE FUNCTION update_notatki_dzienne_updated_at();


RESET ALL;
