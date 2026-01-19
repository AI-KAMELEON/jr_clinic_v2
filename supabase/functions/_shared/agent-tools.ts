/**
 * Definicje funkcji (tools) dostępnych dla agenta ElevenLabs
 * Zgodnie z dokumentacją ElevenLabs Conversational AI
 */

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required: string[];
  };
}

/**
 * Lista wszystkich funkcji dostępnych dla agenta
 */
export function getAgentTools(): AgentTool[] {
  return [
    {
      name: "verify_patient",
      description: "Weryfikuje pacjenta na podstawie numeru telefonu. ZAWSZE użyj tej funkcji jako pierwszej przed umawianiem lub anulowaniem wizyty.",
      parameters: {
        type: "object",
        properties: {
          telefon: {
            type: "string",
            description: "Numer telefonu pacjenta (9 cyfr, bez spacji i myślników). Przykład: '123456789'",
          },
        },
        required: ["telefon"],
      },
    },
    {
      name: "get_available_slots",
      description: "Pobiera dostępne wolne terminy wizyt z tabeli schedule_slots. DOMYŚLNIE zwraca 10 najbliższych terminów od dzisiaj w przód. Użyj tej funkcji gdy pacjent chce umówić wizytę i już zweryfikowałeś go przez verify_patient.",
      parameters: {
        type: "object",
        properties: {
          data: {
            type: "string",
            description: "OPCJONALNA konkretna data YYYY-MM-DD (np. '2025-11-15'). Jeśli NIE podasz, funkcja zwróci najbliższe wolne terminy od dzisiaj w przód.",
          },
          limit: {
            type: "number",
            description: "Maksymalna liczba terminów do zwrócenia (domyślnie 10, maksimum 50)",
          },
          duration_minutes: {
            type: "number",
            description: "Opcjonalna długość wizyty w minutach (wielokrotność 15). Domyślnie 30.",
          },
          time_period: {
            type: "string",
            description: "OPCJONALNA preferowana pora dnia. Obsługiwane wartości: 'rano' lub 'morning' (08:00-12:00), 'po południu'/'popołudnie' lub 'afternoon' (12:00-17:00), 'wieczór'/'wieczor' lub 'evening' (17:00-20:00). Funkcja zwróci tylko sloty z danej pory dnia.",
          },
        },
        required: [],
      },
    },
    {
      name: "get_patient_appointments",
      description: "Pobiera listę zaplanowanych wizyt pacjenta. Użyj tej funkcji gdy pacjent chce anulować wizytę lub sprawdzić swoje wizyty. ZAWSZE wywołaj verify_patient przed tą funkcją.",
      parameters: {
        type: "object",
        properties: {
          patient_id: {
            type: "string",
            description: "ID pacjenta otrzymane z funkcji verify_patient",
          },
          data: {
            type: "string",
            description: "Opcjonalna data w formacie YYYY-MM-DD. Jeśli nie podasz, funkcja zwróci wszystkie przyszłe wizyty od dzisiaj.",
          },
        },
        required: ["patient_id"],
      },
    },
    {
      name: "book_appointment",
      description: "Rezerwuje wizytę dla pacjenta na podstawie slotu z schedule_slots. Użyj TYLKO gdy: 1) pacjent został zweryfikowany (verify_patient), 2) pacjent wybrał konkretny termin (get_available_slots), 3) pacjent potwierdził rezerwację, 4) pacjent WIE jaki rodzaj wizyty potrzebuje. NIGDY nie rezerwuj gdy pacjent nie wie jaki rodzaj wizyty potrzebuje - w takim przypadku poinformuj że recepcja zadzwoni.",
      parameters: {
        type: "object",
        properties: {
          patient_id: {
            type: "string",
            description: "ID pacjenta otrzymane z funkcji verify_patient",
          },
          appointment_id: {
            type: "string",
            description: "ID terminu wizyty otrzymane z funkcji get_available_slots (slot start)",
          },
          duration_minutes: {
            type: "number",
            description: "Długość wizyty w minutach (wielokrotność 15). Domyślnie 30.",
          },
          rodzaj: {
            type: "string",
            description: "Rodzaj wizyty (np. LECZENIE, KONSULTACJA).",
          },
        },
        required: ["patient_id", "appointment_id"],
      },
    },
    {
      name: "cancel_appointment",
      description: "Anuluje zaplanowaną wizytę pacjenta. Użyj TYLKO gdy: 1) pacjent został zweryfikowany (verify_patient), 2) znasz appointment_id z funkcji get_patient_appointments, 3) pacjent potwierdził anulowanie.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: {
            type: "string",
            description: "ID wizyty do anulowania otrzymane z funkcji get_patient_appointments",
          },
        },
        required: ["appointment_id"],
      },
    },
    {
      name: "add_note",
      description: "Dodaje notatkę do istniejącej wizyty pacjenta. Użyj gdy pacjent chce dodać informację do swojej wizyty. ZAWSZE wywołaj verify_patient przed tą funkcją.",
      parameters: {
        type: "object",
        properties: {
          patient_id: {
            type: "string",
            description: "ID pacjenta otrzymane z funkcji verify_patient",
          },
          appointment_id: {
            type: "string",
            description: "ID wizyty otrzymane z funkcji get_patient_appointments",
          },
          note_text: {
            type: "string",
            description: "Treść notatki do dodania",
          },
        },
        required: ["patient_id", "appointment_id", "note_text"],
      },
    },
    {
      name: "update_note",
      description: "Aktualizuje notatkę wizyty pacjenta. Zastępuje istniejącą notatkę nową treścią. Użyj gdy pacjent chce zmienić notatkę do swojej wizyty.",
      parameters: {
        type: "object",
        properties: {
          appointment_id: {
            type: "string",
            description: "ID wizyty otrzymane z funkcji get_patient_appointments",
          },
          note_text: {
            type: "string",
            description: "Nowa treść notatki (zastąpi istniejącą)",
          },
        },
        required: ["appointment_id", "note_text"],
      },
    },
    {
      name: "add_callback_request",
      description: "Rejestruje prośbę o oddzwonienie do administratorów. Użyj gdy pacjent lub osoba dzwoniąca nie może teraz porozmawiać, potrzebuje kontaktu później lub wymaga potwierdzenia ze strony recepcji. ZAWSZE przekaż krótki powód (reason) aby administrator wiedział w jakiej sprawie oddzwonić.",
      parameters: {
        type: "object",
        properties: {
          patient_id: {
            type: "string",
            description: "OPCJONALNE. ID pacjenta z verify_patient jeśli osoba jest w bazie. Jeśli nie znasz - pomiń.",
          },
          phone: {
            type: "string",
            description: "OPCJONALNE. Numer telefonu do oddzwonienia (9 cyfr, bez spacji). Wymagany jeżeli brak patient_id lub numer różni się od numeru pacjenta.",
          },
          patient_name: {
            type: "string",
            description: "OPCJONALNE. Imię i nazwisko rozmówcy, jeżeli nie jest w bazie pacjentów.",
          },
          reason: {
            type: "string",
            description: "KRÓTKI powód oddzwonienia (max 160 znaków). Np. 'prośba o przesunięcie wizyty', 'nowy pacjent pyta o konsultację'.",
          },
          message: {
            type: "string",
            description: "OPCJONALNA dłuższa notatka z dodatkowymi szczegółami przekazanymi przez rozmówcę.",
          },
          callback_date: {
            type: "string",
            description: "OPCJONALNA data oddzwonienia w formacie YYYY-MM-DD. Domyślnie dzisiaj.",
          },
          preferred_time: {
            type: "string",
            description: "OPCJONALNA preferowana pora kontaktu (np. 'rano', 'po 15:00').",
          },
          priority: {
            type: "string",
            description: "OPCJONALNY priorytet: 'low', 'normal' (domyślnie) lub 'high'. Ustaw 'high' gdy sprawa pilna.",
          },
        },
        required: ["reason"],
      },
    },
    {
      name: "reschedule_appointment",
      description: "Przełożenie wizyty pacjenta. Anuluje starą wizytę i rezerwuje nową w jednej operacji. Użyj TYLKO gdy: 1) pacjent został zweryfikowany (verify_patient), 2) znasz old_appointment_id z funkcji get_patient_appointments, 3) znasz new_appointment_id z funkcji get_available_slots, 4) pacjent potwierdził przełożenie.",
      parameters: {
        type: "object",
        properties: {
          old_appointment_id: {
            type: "string",
            description: "ID starej wizyty do anulowania (z get_patient_appointments)",
          },
          new_appointment_id: {
            type: "string",
            description: "ID nowego terminu do rezerwacji (z get_available_slots)",
          },
          patient_id: {
            type: "string",
            description: "ID pacjenta otrzymane z funkcji verify_patient",
          },
          duration_minutes: {
            type: "number",
            description: "Długość nowej wizyty w minutach (wielokrotność 15). Domyślnie 30.",
          },
          rodzaj: {
            type: "string",
            description: "Rodzaj wizyty (opcjonalnie, domyślnie jak w starej wizycie).",
          },
        },
        required: ["old_appointment_id", "new_appointment_id", "patient_id"],
      },
    },
  ];
}




