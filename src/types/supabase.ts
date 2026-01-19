export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      administrators: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cron_logs: {
        Row: {
          id: number
          name: string | null
          ts: string | null
        }
        Insert: {
          id?: number
          name?: string | null
          ts?: string | null
        }
        Update: {
          id?: number
          name?: string | null
          ts?: string | null
        }
        Relationships: []
      }
      notatki_dzienne: {
        Row: {
          created_at: string | null
          data: string
          id: string
          tresc: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          id?: string
          tresc: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          id?: string
          tresc?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pacjenci: {
        Row: {
          adres: string | null
          brak_pesel: boolean | null
          created_at: string | null
          data_urodzenia: string | null
          email: string | null
          id: string
          imie: string
          nazwisko: string
          notatki: string | null
          pesel: string | null
          telefon: string
        }
        Insert: {
          adres?: string | null
          brak_pesel?: boolean | null
          created_at?: string | null
          data_urodzenia?: string | null
          email?: string | null
          id?: string
          imie: string
          nazwisko: string
          notatki?: string | null
          pesel?: string | null
          telefon: string
        }
        Update: {
          adres?: string | null
          brak_pesel?: boolean | null
          created_at?: string | null
          data_urodzenia?: string | null
          email?: string | null
          id?: string
          imie?: string
          nazwisko?: string
          notatki?: string | null
          pesel?: string | null
          telefon?: string
        }
        Relationships: []
      }
      plany_pracy: {
        Row: {
          aktywny: boolean
          created_at: string | null
          dzien_tygodnia: string
          godzina_do: string
          godzina_od: string
          id: string
          updated_at: string | null
        }
        Insert: {
          aktywny?: boolean
          created_at?: string | null
          dzien_tygodnia: string
          godzina_do: string
          godzina_od: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          aktywny?: boolean
          created_at?: string | null
          dzien_tygodnia?: string
          godzina_do?: string
          godzina_od?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          created_at: string | null
          data_wizyty: string
          godzina: string
          id: string
          pacjent_id: string | null
          status: string | null
          telefon: string
          tresc: string | null
          typ: string | null
          wizyta_id: string | null
        }
        Insert: {
          created_at?: string | null
          data_wizyty: string
          godzina: string
          id?: string
          pacjent_id?: string | null
          status?: string | null
          telefon: string
          tresc?: string | null
          typ?: string | null
          wizyta_id?: string | null
        }
        Update: {
          created_at?: string | null
          data_wizyty?: string
          godzina?: string
          id?: string
          pacjent_id?: string | null
          status?: string | null
          telefon?: string
          tresc?: string | null
          typ?: string | null
          wizyta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_pacjent_id_fkey"
            columns: ["pacjent_id"]
            isOneToOne: false
            referencedRelation: "pacjenci"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_pacjent_id_fkey"
            columns: ["pacjent_id"]
            isOneToOne: false
            referencedRelation: "wizyty_pacjenci_view"
            referencedColumns: ["pacjent_id"]
          },
          {
            foreignKeyName: "sms_logs_wizyta_id_fkey"
            columns: ["wizyta_id"]
            isOneToOne: false
            referencedRelation: "wizyty"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_wizyta_id_fkey"
            columns: ["wizyta_id"]
            isOneToOne: false
            referencedRelation: "wizyty_pacjenci_view"
            referencedColumns: ["wizyta_id"]
          },
        ]
      }
      urlopy: {
        Row: {
          created_at: string | null
          data_do: string
          data_od: string
          id: string
          opis: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_do: string
          data_od: string
          id?: string
          opis?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_do?: string
          data_od?: string
          id?: string
          opis?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wizyty: {
        Row: {
          created_at: string | null
          data: string
          godzina: string
          godzina_do: string
          godzina_od: string
          id: string
          notatki: string | null
          opis_wizyty: string | null
          pacjent_id: string | null
          rodzaj: string
          status: string | null
          wykonane_zabiegi: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          godzina: string
          godzina_do: string
          godzina_od: string
          id?: string
          notatki?: string | null
          opis_wizyty?: string | null
          pacjent_id?: string | null
          rodzaj: string
          status?: string | null
          wykonane_zabiegi?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          godzina?: string
          godzina_do?: string
          godzina_od?: string
          id?: string
          notatki?: string | null
          opis_wizyty?: string | null
          pacjent_id?: string | null
          rodzaj?: string
          status?: string | null
          wykonane_zabiegi?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wizyty_pacjent_id_fkey"
            columns: ["pacjent_id"]
            isOneToOne: false
            referencedRelation: "pacjenci"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wizyty_pacjent_id_fkey"
            columns: ["pacjent_id"]
            isOneToOne: false
            referencedRelation: "wizyty_pacjenci_view"
            referencedColumns: ["pacjent_id"]
          },
        ]
      }
      wizyty_backup: {
        Row: {
          created_at: string | null
          data: string | null
          godzina: string | null
          godzina_do: string | null
          godzina_od: string | null
          id: string | null
          notatki: string | null
          opis_wizyty: string | null
          pacjent_id: string | null
          rodzaj: string | null
          status: string | null
          wykonane_zabiegi: string | null
        }
        Insert: {
          created_at?: string | null
          data?: string | null
          godzina?: string | null
          godzina_do?: string | null
          godzina_od?: string | null
          id?: string | null
          notatki?: string | null
          opis_wizyty?: string | null
          pacjent_id?: string | null
          rodzaj?: string | null
          status?: string | null
          wykonane_zabiegi?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string | null
          godzina?: string | null
          godzina_do?: string | null
          godzina_od?: string | null
          id?: string | null
          notatki?: string | null
          opis_wizyty?: string | null
          pacjent_id?: string | null
          rodzaj?: string | null
          status?: string | null
          wykonane_zabiegi?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      sms_logs_view: {
        Row: {
          created_at: string | null
          data_wizyty: string | null
          godzina: string | null
          imie: string | null
          log_id: string | null
          nazwisko: string | null
          rodzaj: string | null
          status: string | null
          telefon: string | null
          tresc: string | null
          typ: string | null
        }
        Relationships: []
      }
      wizyty_pacjenci_view: {
        Row: {
          data: string | null
          godzina: string | null
          imie: string | null
          nazwisko: string | null
          pacjent_id: string | null
          rodzaj: string | null
          telefon: string | null
          wizyta_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
