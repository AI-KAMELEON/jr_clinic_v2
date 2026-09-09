-- Add order column for additional visits (same pattern as wizyty_cito.kolejnosc)
ALTER TABLE "public"."wizyty_dodatkowe"
ADD COLUMN IF NOT EXISTS "kolejnosc" integer;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY data
      ORDER BY created_at ASC NULLS LAST, id
    ) AS rn
  FROM "public"."wizyty_dodatkowe"
)
UPDATE "public"."wizyty_dodatkowe" wd
SET "kolejnosc" = ranked.rn
FROM ranked
WHERE wd.id = ranked.id
  AND (wd.kolejnosc IS NULL OR wd.kolejnosc = 0);

UPDATE "public"."wizyty_dodatkowe"
SET "kolejnosc" = 1
WHERE "kolejnosc" IS NULL;

ALTER TABLE "public"."wizyty_dodatkowe"
ALTER COLUMN "kolejnosc" SET DEFAULT 1;

ALTER TABLE "public"."wizyty_dodatkowe"
ALTER COLUMN "kolejnosc" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_wizyty_dodatkowe_data_kolejnosc"
ON "public"."wizyty_dodatkowe" ("data", "kolejnosc");

DROP VIEW IF EXISTS "public"."wizyty_dodatkowe_pacjenci_view";

CREATE VIEW "public"."wizyty_dodatkowe_pacjenci_view" AS
SELECT
    wd.id,
    wd.pacjent_id,
    wd.data,
    wd.kolejnosc,
    wd.rodzaj,
    wd.notatki,
    wd.status,
    wd.created_at,
    p.imie,
    p.nazwisko,
    p.telefon
FROM "public"."wizyty_dodatkowe" wd
JOIN "public"."pacjenci" p ON p.id = wd.pacjent_id;

GRANT ALL ON TABLE "public"."wizyty_dodatkowe_pacjenci_view" TO "anon";
GRANT ALL ON TABLE "public"."wizyty_dodatkowe_pacjenci_view" TO "authenticated";
GRANT ALL ON TABLE "public"."wizyty_dodatkowe_pacjenci_view" TO "service_role";
