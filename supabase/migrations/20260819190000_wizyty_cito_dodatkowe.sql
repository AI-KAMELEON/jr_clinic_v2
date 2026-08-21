-- Wizyty Cito - urgent queue independent of calendar
CREATE TABLE IF NOT EXISTS "public"."wizyty_cito" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "pacjent_id" uuid NOT NULL,
    "kolejnosc" integer NOT NULL,
    "powod" text,
    "notatki" text,
    "status" text DEFAULT 'oczekujaca'::text NOT NULL,
    "created_at" timestamptz DEFAULT now(),
    CONSTRAINT "wizyty_cito_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wizyty_cito_pacjent_id_fkey" FOREIGN KEY ("pacjent_id") REFERENCES "public"."pacjenci"("id") ON DELETE CASCADE,
    CONSTRAINT "wizyty_cito_status_check" CHECK ("status" = ANY (ARRAY['oczekujaca'::text, 'zrealizowana'::text, 'anulowana'::text]))
);

CREATE INDEX IF NOT EXISTS "idx_wizyty_cito_status_kolejnosc" ON "public"."wizyty_cito" ("status", "kolejnosc");

-- Wizyty dodatkowe - short add-on visits, not blocking calendar
CREATE TABLE IF NOT EXISTS "public"."wizyty_dodatkowe" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "pacjent_id" uuid NOT NULL,
    "data" date NOT NULL,
    "rodzaj" text NOT NULL,
    "notatki" text,
    "status" text DEFAULT 'zaplanowana'::text NOT NULL,
    "created_at" timestamptz DEFAULT now(),
    CONSTRAINT "wizyty_dodatkowe_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "wizyty_dodatkowe_pacjent_id_fkey" FOREIGN KEY ("pacjent_id") REFERENCES "public"."pacjenci"("id") ON DELETE CASCADE,
    CONSTRAINT "wizyty_dodatkowe_status_check" CHECK ("status" = ANY (ARRAY['zaplanowana'::text, 'wykonana'::text, 'anulowana'::text]))
);

CREATE INDEX IF NOT EXISTS "idx_wizyty_dodatkowe_data_status" ON "public"."wizyty_dodatkowe" ("data", "status");

CREATE OR REPLACE VIEW "public"."wizyty_cito_pacjenci_view" AS
SELECT
    wc.id,
    wc.pacjent_id,
    wc.kolejnosc,
    wc.powod,
    wc.notatki,
    wc.status,
    wc.created_at,
    p.imie,
    p.nazwisko,
    p.telefon
FROM "public"."wizyty_cito" wc
JOIN "public"."pacjenci" p ON p.id = wc.pacjent_id;

CREATE OR REPLACE VIEW "public"."wizyty_dodatkowe_pacjenci_view" AS
SELECT
    wd.id,
    wd.pacjent_id,
    wd.data,
    wd.rodzaj,
    wd.notatki,
    wd.status,
    wd.created_at,
    p.imie,
    p.nazwisko,
    p.telefon
FROM "public"."wizyty_dodatkowe" wd
JOIN "public"."pacjenci" p ON p.id = wd.pacjent_id;

ALTER TABLE "public"."wizyty_cito" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."wizyty_dodatkowe" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wizyty cito full access for administrators"
ON "public"."wizyty_cito"
TO "authenticated"
USING (
    EXISTS (
        SELECT 1 FROM "public"."administrators"
        WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
    )
);

CREATE POLICY "Wizyty dodatkowe full access for administrators"
ON "public"."wizyty_dodatkowe"
TO "authenticated"
USING (
    EXISTS (
        SELECT 1 FROM "public"."administrators"
        WHERE "administrators"."email" = (auth.jwt() ->> 'email'::text)
    )
);

GRANT ALL ON TABLE "public"."wizyty_cito" TO "anon";
GRANT ALL ON TABLE "public"."wizyty_cito" TO "authenticated";
GRANT ALL ON TABLE "public"."wizyty_cito" TO "service_role";

GRANT ALL ON TABLE "public"."wizyty_dodatkowe" TO "anon";
GRANT ALL ON TABLE "public"."wizyty_dodatkowe" TO "authenticated";
GRANT ALL ON TABLE "public"."wizyty_dodatkowe" TO "service_role";

GRANT ALL ON TABLE "public"."wizyty_cito_pacjenci_view" TO "anon";
GRANT ALL ON TABLE "public"."wizyty_cito_pacjenci_view" TO "authenticated";
GRANT ALL ON TABLE "public"."wizyty_cito_pacjenci_view" TO "service_role";

GRANT ALL ON TABLE "public"."wizyty_dodatkowe_pacjenci_view" TO "anon";
GRANT ALL ON TABLE "public"."wizyty_dodatkowe_pacjenci_view" TO "authenticated";
GRANT ALL ON TABLE "public"."wizyty_dodatkowe_pacjenci_view" TO "service_role";
