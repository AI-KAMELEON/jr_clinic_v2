import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Pacjent = Tables<"pacjenci">;
export type Wizyta = Tables<"wizyty">;
export type WizytaInsert = Inserts<"wizyty">;
export type WizytaUpdate = Updates<"wizyty">;
export type Urlop = Tables<"urlopy">;
export type UrlopInsert = Inserts<"urlopy">;
export type UrlopUpdate = Updates<"urlopy">;
export type PlanPracy = Tables<"plany_pracy">;
export type PlanPracyInsert = Inserts<"plany_pracy">;
export type PlanPracyUpdate = Updates<"plany_pracy">;

// Visit status types
export type VisitStatus = 'zaplanowana' | 'wykonana' | 'odwolana';

// Work schedule types
export type WorkSchedule = {
  [key: string]: {
    aktywny: boolean;
    godziny: {
      od: string;
      do: string;
    };
  };
};
