import React, { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import WizytyDodatkowePanel from "./WizytyDodatkowePanel";
import DailyNoteEditor from "./DailyNoteEditor";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  CalendarIcon,
  Clock,
  Plus,
  Edit,
  Trash2,
  Search,
  AlertCircle,
  Settings,
  CheckCircle,
  X,
  Users,
  Printer,
  Phone,
  RotateCcw,
} from "lucide-react";
import {
  supabase,
  type Pacjent,
  type Wizyta,
  type WizytaInsert,
  type Urlop,
  type UrlopInsert,
  type VisitStatus,
  type WorkSchedule,
} from "@/lib/supabase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface WizytaWithPacjent extends Wizyta {
  pacjenci: Pacjent;
}

interface KalendarzWizytProps {
  onNavigateToPatients?: () => void;
  onPatientSelect?: (patientId: string) => void;
}

interface GodzinyPracy {
  od: string;
  do: string;
}

// Use WorkSchedule type from supabase.ts instead of local interface

// Tablica z polskimi nazwami miesięcy w mianowniku (bez odmian)
const polskieMiesiace = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"
];
const MONTH_PREVIEW_START_MINUTES = 8 * 60;
const MONTH_PREVIEW_END_MINUTES = 20 * 60;
const MONTH_PREVIEW_SLOT_MINUTES = 15;
const VACATION_HIGHLIGHT_START_MINUTES = 9 * 60;
const VACATION_HIGHLIGHT_END_MINUTES = 18 * 60 + 45;

const KalendarzWizyt = ({ onNavigateToPatients, onPatientSelect }: KalendarzWizytProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const [selectedView, setSelectedView] = useState("dzien");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isWorkScheduleDialogOpen, setIsWorkScheduleDialogOpen] =
    useState(false);
  const [isVacationDialogOpen, setIsVacationDialogOpen] = useState(false);
  const [isMonthPreviewOpen, setIsMonthPreviewOpen] = useState(false);
  const [monthPreviewDate, setMonthPreviewDate] = useState<Date>(new Date());
  const [highlightedWizytaId, setHighlightedWizytaId] = useState<string | null>(null);
  const [selectedWizyta, setSelectedWizyta] =
    useState<WizytaWithPacjent | null>(null);
  const [selectedUrlop, setSelectedUrlop] = useState<Urlop | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchingSlots, setSearchingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<
    Array<{ date: string; time: string; displayDate: string }>
  >([]);
  const [currentSearchDate, setCurrentSearchDate] = useState<Date>(new Date());
  const [currentSearchTimeIndex, setCurrentSearchTimeIndex] = useState(0);
  const [slotDuration, setSlotDuration] = useState<'15min' | '30min'>('15min');

  // Plan pracy
  const [planPracy, setPlanPracy] = useState<WorkSchedule>({
    poniedzialek: { aktywny: true, godziny: { od: "08:00", do: "17:00" } },
    wtorek: { aktywny: true, godziny: { od: "08:00", do: "17:00" } },
    sroda: { aktywny: true, godziny: { od: "08:00", do: "17:00" } },
    czwartek: { aktywny: true, godziny: { od: "08:00", do: "17:00" } },
    piatek: { aktywny: true, godziny: { od: "08:00", do: "17:00" } },
    sobota: { aktywny: false, godziny: { od: "08:00", do: "14:00" } },
    niedziela: { aktywny: false, godziny: { od: "08:00", do: "14:00" } },
  });
  const [tempPlanPracy, setTempPlanPracy] = useState<WorkSchedule>(planPracy);

  const [wizyty, setWizyty] = useState<WizytaWithPacjent[]>([]);
  const [wizytyCache, setWizytyCache] = useState<Map<string, WizytaWithPacjent[]>>(new Map()); // Cache dla wizyt
  const [pacjenci, setPacjenci] = useState<Pacjent[]>([]);
  const [urlopy, setUrlopy] = useState<Urlop[]>([]);
  const [searchResults, setSearchResults] = useState<Pacjent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedPacjent, setSelectedPacjent] = useState<Pacjent | null>(null);
  const [isSelectingPatient, setIsSelectingPatient] = useState(false);
  const [showPatientError, setShowPatientError] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const [nowaWizyta, setNowaWizyta] = useState<Partial<WizytaInsert>>({
    data: format(new Date(), "yyyy-MM-dd"),
    godzina: "08:00:00",
    godzina_od: "08:00:00",
    godzina_do: "08:30:00",
    rodzaj: "LECZENIE",
    notatki: "",
    status: "zaplanowana",
  });

  // Visit duration types
  const [visitDuration, setVisitDuration] = useState<'15min' | '30min' | 'custom'>('30min');
  const [customDurationMinutes, setCustomDurationMinutes] = useState<number>(60);
  const [customStartTime, setCustomStartTime] = useState<string>('08:00');
  const [customEndTime, setCustomEndTime] = useState<string>('09:00');
  const [timeSlotWarning, setTimeSlotWarning] = useState<string>('');
  const [timeSlotWarningDialog, setTimeSlotWarningDialog] = useState(false);
  const [timeSlotWarningMessage, setTimeSlotWarningMessage] = useState('');

  const [nowyUrlop, setNowyUrlop] = useState<Partial<UrlopInsert>>({
    data_od: format(new Date(), "yyyy-MM-dd"),
    data_do: format(new Date(), "yyyy-MM-dd"),
    opis: "",
  });


  const godzinyPrzyjec = [
    "08:00:00",
    "08:30:00",
    "09:00:00",
    "09:30:00",
    "10:00:00",
    "10:30:00",
    "11:00:00",
    "11:30:00",
    "12:00:00",
    "12:30:00",
    "13:00:00",
    "13:30:00",
    "14:00:00",
    "14:30:00",
    "15:00:00",
    "15:30:00",
    "16:00:00",
    "16:30:00",
    "17:00:00",
    "17:30:00",
  ];

  const rodzajeWizyt = [
    "LECZENIE",
    "GUMKI",
    "ZAŁOŻENIE APARATU GÓRA",
    "ZAŁOŻENIE APARATU DÓŁ",
    "ZDJĘCIE APARATU GÓRA",
    "ZDJĘCIE APARATU DÓŁ",
    "WYRWANIE ZĘBA",
    "PORCELANA GÓRA",
    "PORCELANA DÓŁ",
    "LICÓWKI GÓRA",
    "LICÓWKI DÓŁ",
    "BONDING GÓRA",
    "BONDING DÓŁ",
    "KORONY GÓRA",
    "KORONY DÓŁ",
    "MOST GÓRA",
    "MOST DÓŁ",
    "PROTEZA GÓRA",
    "PROTEZA DÓŁ",
    "POPRAWA LICÓWKI",
    "POPRAWA BONDING",
    "POPRAWA KORON",
    "POPRAWA PORCELANY",
    "POPRAWA PROTEZY",
    "PRZEGLĄD",
    "LAKIEROWANIE",
    "KAMIEŃ",
    "WYBIELANIE",
    "PLOMBA",
    "SZLIFOWANIE",
    "UKRUSZONY ZĄB",
    "BOTOX",
    "NICI",
    "USTA",
    "GAZ",
    "KONSULTACJA",
  ];

  const monthPreviewSlots = Array.from(
    {
      length:
        (MONTH_PREVIEW_END_MINUTES - MONTH_PREVIEW_START_MINUTES) /
        MONTH_PREVIEW_SLOT_MINUTES,
    },
    (_, index) => {
      const totalMinutes =
        MONTH_PREVIEW_START_MINUTES + index * MONTH_PREVIEW_SLOT_MINUTES;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;
    },
  );

  const getMonthPreviewSlotState = (date: Date, slotStart: string) => {
    const dateKey = format(date, "yyyy-MM-dd");
    const vacation = isVacationDay(dateKey);
    const slotStartMinutes =
      Number(slotStart.substring(0, 2)) * 60 +
      Number(slotStart.substring(3, 5));
    const slotEndMinutes = slotStartMinutes + MONTH_PREVIEW_SLOT_MINUTES;

    if (
      vacation &&
      slotStartMinutes >= VACATION_HIGHLIGHT_START_MINUTES &&
      slotStartMinutes <= VACATION_HIGHLIGHT_END_MINUTES
    ) {
      return { state: "vacation" as const };
    }

    const dayWizyty = getWizytyForDate(date).filter(
      (wizyta) => wizyta.status !== "odwolana",
    );

    const matchingVisit = dayWizyty.find((wizyta) => {
      const visitStart = wizyta.godzina.substring(0, 5);
      const visitEnd = (
        wizyta.godzina_do || addMinutesToTime(wizyta.godzina, 30)
      ).substring(0, 5);
      const visitStartMinutes =
        Number(visitStart.substring(0, 2)) * 60 +
        Number(visitStart.substring(3, 5));
      const visitEndMinutes =
        Number(visitEnd.substring(0, 2)) * 60 +
        Number(visitEnd.substring(3, 5));

      return (
        slotStartMinutes < visitEndMinutes && slotEndMinutes > visitStartMinutes
      );
    });

    if (!matchingVisit) {
      return { state: "free" as const };
    }

    return {
      state: matchingVisit.rodzaj === "GUMKI" ? ("gumki" as const) : ("occupied" as const),
      visit: matchingVisit,
    };
  };

  // Fetch pacjenci from database
  const fetchPacjenci = async () => {
    try {
      const { data, error } = await supabase
        .from("pacjenci")
        .select("*")
        .order("nazwisko");

      if (error) throw error;
      setPacjenci(data || []);
    } catch (err) {
      console.error("Error fetching pacjenci:", err);
      setError("Błąd podczas pobierania listy pacjentów");
    }
  };

  // Search pacjenci by name
  const searchPacjenci = async (query: string) => {
    console.log("🔍 FUNKCJA WYSZUKIWANIA URUCHOMIONA! Query:", query);
    
    if (!query.trim()) {
      console.log("❌ Query puste, zwracam pustą listę");
      setSearchResults([]);
      return;
    }

    try {
      console.log("🔍 Wyszukuję w bazie danych...");
      
      // Sprawdź czy query zawiera cyfry (numer telefonu)
      const hasNumbers = /\d/.test(query);
      console.log("🔍 Zawiera cyfry (telefon):", hasNumbers);
      
      let searchQuery;
      if (hasNumbers) {
        // Normalizuj numer telefonu - usuń wszystko oprócz cyfr
        const cleanPhone = query.replace(/\D/g, '');
        console.log("🔍 Oryginalny numer:", query);
        console.log("🔍 Oczyszczony numer:", cleanPhone);
        
        // Wyszukaj po numerze telefonu (zawiera oczyszczony numer)
        searchQuery = supabase
          .from("pacjenci")
          .select("*")
          .ilike("telefon", `%${cleanPhone}%`)
          .order("nazwisko")
          .limit(10);
      } else {
        // Podziel query na imię i nazwisko
        const parts = query.trim().split(" ");
        const imie = parts[0] || "";
        const nazwisko = parts[1] || "";
        
        console.log("🔍 Imię:", imie, "Nazwisko:", nazwisko);
        
        if (nazwisko) {
          // Szukaj po imieniu I nazwisku
          searchQuery = supabase
            .from("pacjenci")
            .select("*")
            .ilike("imie", `%${imie}%`)
            .ilike("nazwisko", `%${nazwisko}%`)
            .order("nazwisko")
            .limit(10);
        } else {
          // Szukaj tylko po imieniu lub nazwisku
          searchQuery = supabase
            .from("pacjenci")
            .select("*")
            .or(`imie.ilike.%${imie}%,nazwisko.ilike.%${imie}%`)
            .order("nazwisko")
            .limit(10);
        }
      }
      
      const { data, error } = await searchQuery;

      if (error) {
        console.error("❌ Błąd bazy danych:", error);
        throw error;
      }
      
      console.log("✅ Wyniki z bazy:", data);
      setSearchResults(data || []);
      setIsSearchOpen(true);
    } catch (err) {
      console.error("❌ Error searching pacjenci:", err);
      setError("Błąd podczas wyszukiwania pacjentów");
    }
  };

  // Funkcje pomocnicze dla widoków (muszą być przed fetchWizyty)
  const getWeekDates = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    startOfWeek.setDate(diff);
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

  const getMonthDates = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get first Monday of the month (or previous Monday if month doesn't start on Monday)
    const startDate = new Date(firstDay);
    const dayOfWeek = firstDay.getDay();
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate.setDate(firstDay.getDate() - daysToSubtract);
    
    const monthDates = [];
    const currentDate = new Date(startDate);
    
    // Generate 42 days (6 weeks) to cover the month
    for (let i = 0; i < 42; i++) {
      monthDates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return monthDates;
  };

  // Fetch wizyty for a specific date range
  const fetchWizytyForRange = async (startDate: string, endDate: string, cacheKey: string, forceRefresh: boolean = false) => {
    try {
      // Sprawdź cache tylko jeśli nie wymuszamy odświeżenia
      if (!forceRefresh && wizytyCache.has(cacheKey)) {
        const cached = wizytyCache.get(cacheKey) || [];
        // Użyj cache - zastąp wizyty dla tego zakresu
        setWizyty(prev => {
          const merged = new Map<string, WizytaWithPacjent>();
          // Dodaj wizyty spoza tego zakresu
          prev.forEach(w => {
            const wDate = w.data;
            if (wDate < startDate || wDate > endDate) {
              merged.set(w.id, w);
            }
          });
          // Dodaj wizyty z cache dla tego zakresu
          cached.forEach(w => merged.set(w.id, w));
          return Array.from(merged.values());
        });
        return;
      }

      const { data, error } = await supabase
        .from("wizyty")
        .select(
          `
          *,
          pacjenci (*)
        `,
        )
        .gte("data", startDate)
        .lte("data", endDate)
        .order("data")
        .order("godzina");

      if (error) throw error;

      // Zapisz w cache
      setWizytyCache(prev => {
        const newCache = new Map(prev);
        newCache.set(cacheKey, data || []);
        return newCache;
      });

      // Zaktualizuj wizyty - zastąp wizyty dla tego zakresu
      setWizyty(prev => {
        const merged = new Map<string, WizytaWithPacjent>();
        // Dodaj wizyty spoza tego zakresu
        prev.forEach(w => {
          const wDate = w.data;
          if (wDate < startDate || wDate > endDate) {
            merged.set(w.id, w);
          }
        });
        // Dodaj nowe wizyty dla tego zakresu
        (data || []).forEach(w => merged.set(w.id, w));
        return Array.from(merged.values());
      });
    } catch (err) {
      console.error("Error fetching wizyty for range:", err);
      setError("Błąd podczas pobierania wizyt");
    }
  };

  // Fetch wizyty based on current view
  const fetchWizyty = async (forceRefresh: boolean = false) => {
    if (!selectedDate) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    if (selectedView === "dzien") {
      // Widok dzienny - pobierz tylko ten dzień
      await fetchWizytyForRange(dateStr, dateStr, `day-${dateStr}`, forceRefresh);
    } else if (selectedView === "tydzien") {
      // Widok tygodniowy - pobierz cały tydzień
      const weekDates = getWeekDates(selectedDate);
      const startDate = format(weekDates[0], "yyyy-MM-dd");
      const endDate = format(weekDates[6], "yyyy-MM-dd");
      await fetchWizytyForRange(startDate, endDate, `week-${startDate}`, forceRefresh);
    }
  };

  // Refresh wizyty for a specific date (used after save/update/delete)
  const refreshWizytyForDate = async (date: string) => {
    // Invalidate cache for this date and related ranges
    setWizytyCache(prev => {
      const newCache = new Map(prev);
      // Remove cache entries that might contain this date
      const keysToRemove: string[] = [];
      newCache.forEach((_, key) => {
        // Remove day cache for this date
        if (key === `day-${date}`) {
          keysToRemove.push(key);
        }
        // Remove week cache if date is in that week
        if (key.startsWith(`week-`)) {
          const weekStart = key.replace('week-', '');
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          const weekEndStr = format(weekEnd, "yyyy-MM-dd");
          if (date >= weekStart && date <= weekEndStr) {
            keysToRemove.push(key);
          }
        }
        // Remove month cache if date is in that month
        if (key.startsWith(`month-`)) {
          const monthKey = key.replace('month-', '');
          const [year, month] = monthKey.split('-');
          const dateObj = new Date(date + "T00:00:00");
          if (dateObj.getFullYear().toString() === year && (dateObj.getMonth() + 1).toString().padStart(2, '0') === month) {
            keysToRemove.push(key);
          }
        }
      });
      keysToRemove.forEach(key => newCache.delete(key));
      return newCache;
    });
    
    // Re-fetch based on current view - WYMUŚ odświeżenie (pomiń cache)
    await fetchWizyty(true);
  };

  // Funkcja pomocnicza do porównywania dat (niezawodna)
  const isSameDate = (date1: string | Date, date2: string | Date): boolean => {
    const d1 = typeof date1 === 'string' ? new Date(date1 + "T00:00:00") : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2 + "T00:00:00") : date2;
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  // Fetch urlopy from database
  const fetchUrlopy = async () => {
    try {
      console.log("Fetching urlopy...");
      const { data, error } = await supabase
        .from("urlopy")
        .select("*")
        .order("data_od");

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      console.log("Urlopy fetched:", data);
      setUrlopy(data || []);
    } catch (err) {
      console.error("Error fetching urlopy:", err);
      setError(`Błąd podczas pobierania urlopów: ${err.message || err.toString()}`);
    }
  };

  // Fetch plan pracy from database
  const fetchPlanPracy = async () => {
    try {
      console.log("Fetching plan pracy...");
      const { data, error } = await supabase
        .from("plany_pracy")
        .select("*")
        .order("dzien_tygodnia");

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      console.log("Plan pracy fetched:", data);
      
      if (data && data.length > 0) {
        const workSchedule: WorkSchedule = {};
        data.forEach((item) => {
          workSchedule[item.dzien_tygodnia] = {
            aktywny: item.aktywny,
            godziny: {
              od: item.godzina_od.substring(0, 5), // Convert HH:MM:SS to HH:MM
              do: item.godzina_do.substring(0, 5),
            },
          };
        });
        setPlanPracy(workSchedule);
        setTempPlanPracy(workSchedule);
      }
    } catch (err) {
      console.error("Error fetching plan pracy:", err);
      setError(`Błąd podczas pobierania planu pracy: ${err.message || err.toString()}`);
    }
  };


  // Get day name in Polish
  const getDayName = (date: Date): keyof WorkSchedule => {
    const days: (keyof WorkSchedule)[] = [
      "niedziela",
      "poniedzialek",
      "wtorek",
      "sroda",
      "czwartek",
      "piatek",
      "sobota",
    ];
    return days[date.getDay()];
  };

  // Add minutes to time string
  const addMinutesToTime = (timeStr: string, minutes: number): string => {
    const [hours, mins] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}:00`;
  };

  // Calculate duration in minutes between two time strings
  const calculateDuration = (startTime: string, endTime: string): number => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes - startMinutes;
  };

  // Update visit times based on duration selection
  const updateVisitTimes = (startTime: string, duration: '15min' | '30min' | 'custom', customStart?: string, customEnd?: string, customMinutes?: number) => {
    if (duration === 'custom') {
      if (customStart && customEnd) {
        return {
          godzina: customStart + ':00',
          godzina_od: customStart + ':00',
          godzina_do: customEnd + ':00',
          customStartTime: customStart,
        };
      } else if (customMinutes) {
        return {
          godzina: startTime,
          godzina_od: startTime,
          godzina_do: addMinutesToTime(startTime, customMinutes),
          customStartTime: startTime.substring(0, 5), // HH:MM format
        };
      } else {
        // Dla custom wizyt bez customStart/customEnd/customMinutes
        // Użyj przekazanej wartości startTime (wybranej z dropdown)
        const endTime = addMinutesToTime(startTime, customDurationMinutes || 60);
        
        return {
          godzina: startTime,
          godzina_od: startTime,
          godzina_do: endTime,
          customStartTime: startTime.substring(0, 5), // HH:MM format
        };
      }
    }
    
    const minutes = duration === '15min' ? 15 : 30;
    return {
      godzina: startTime,
      godzina_od: startTime,
      godzina_do: addMinutesToTime(startTime, minutes),
    };
  };

  // Generate working hours for a specific date based on work schedule
  const generateWorkingHours = (
    date: string, 
    duration: '15min' | '30min' | 'custom' = '30min', 
    customMinutes?: number,
    visitsForDate?: WizytaWithPacjent[] // Opcjonalny parametr z wizytami dla danej daty
  ): string[] => {
    const dateObj = new Date(date + "T00:00:00");
    const dayName = getDayName(dateObj);
    const daySchedule = planPracy[dayName];
    
    if (!daySchedule || !daySchedule.aktywny) {
      return [];
    }

    // Użyj przekazanych wizyt lub wizyt z state (exclude cancelled visits)
    const wizytyNaDzien = visitsForDate 
      ? visitsForDate.filter((w) => w.status !== 'odwolana')
      : wizyty.filter((w) => isSameDate(w.data, date) && w.status !== 'odwolana');
    
    const hours: string[] = [];
    const startTime = daySchedule.godziny.od;
    const endTime = daySchedule.godziny.do;
    
    // Parse start and end times
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    // Determine visit duration in minutes
    let visitDurationMinutes: number;
    if (duration === 'custom' && customMinutes) {
      visitDurationMinutes = customMinutes;
    } else {
      visitDurationMinutes = duration === '15min' ? 15 : 30;
    }
    
    // Always generate 15-minute slots for better granularity
    let currentHour = startHour;
    let currentMin = startMin;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}:00`;
      
      // Check if this slot can accommodate the visit duration
      const visitEndTime = addMinutesToTime(timeStr, visitDurationMinutes);
      const [visitEndHour, visitEndMin] = visitEndTime.split(':').map(Number);
      const [workEndHour, workEndMin] = endTime.split(':').map(Number);
      
      // Check if visit would fit within working hours
      const fitsInWorkHours = visitEndHour < workEndHour || (visitEndHour === workEndHour && visitEndMin <= workEndMin);
      
      if (fitsInWorkHours) {
        // Check if this slot conflicts with existing visits
        const hasConflict = wizytyNaDzien.some((wizyta) => {
          const existingStart = wizyta.godzina;
          const existingEnd = wizyta.godzina_do || addMinutesToTime(wizyta.godzina, 30);
          
          // Check if new visit overlaps with existing visit
          return (timeStr < existingEnd && visitEndTime > existingStart);
        });
        
        if (!hasConflict) {
          hours.push(timeStr);
        }
      }
      
      // Always add 15 minutes for granular slot generation
      currentMin += 15;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour++;
      }
    }
    
    return hours;
  };

  // Generate slots in a time range with specified interval
  const generateSlotsInRange = (startTime: string, endTime: string, intervalMinutes: number): string[] => {
    const slots = [];
    let current = startTime;
    
    while (current < endTime) {
      slots.push(current);
      current = addMinutesToTime(current, intervalMinutes);
    }
    
    return slots;
  };

  // Generate all time slots (available and occupied) for display
  const generateAllTimeSlots = (date: string, duration: '15min' | '30min' | 'custom' = '30min', customMinutes?: number): Array<{time: string, available: boolean, reason?: string}> => {
    const dateObj = new Date(date + "T00:00:00");
    const dayName = getDayName(dateObj);
    const daySchedule = planPracy[dayName];
    
    if (!daySchedule || !daySchedule.aktywny) {
      return [];
    }

    // Get existing visits for this date (exclude cancelled visits)
    const wizytyNaDzien = wizyty.filter((w) => isSameDate(w.data, date) && w.status !== 'odwolana');
    
    const slots: Array<{time: string, available: boolean, reason?: string}> = [];
    const startTime = daySchedule.godziny.od;
    const endTime = daySchedule.godziny.do;
    
    // Parse start and end times
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    // Determine visit duration in minutes
    let visitDurationMinutes: number;
    if (duration === 'custom' && customMinutes) {
      visitDurationMinutes = customMinutes;
    } else {
      visitDurationMinutes = duration === '15min' ? 15 : 30;
    }
    
    // Generate base 15-minute slots
    let currentHour = startHour;
    let currentMin = startMin;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}:00`;
      
      // Check if this slot can accommodate the visit duration
      const visitEndTime = addMinutesToTime(timeStr, visitDurationMinutes);
      const [visitEndHour, visitEndMin] = visitEndTime.split(':').map(Number);
      const [workEndHour, workEndMin] = endTime.split(':').map(Number);
      
      // Check if visit would fit within working hours
      const fitsInWorkHours = visitEndHour < workEndHour || (visitEndHour === workEndHour && visitEndMin <= workEndMin);
      
      if (!fitsInWorkHours) {
        slots.push({
          time: timeStr,
          available: false,
          reason: 'Poza godzinami pracy'
        });
      } else {
        // Check if this slot conflicts with existing visits
        // For longer visits, check if ALL required slots in the range are free
        const allSlotsInRange = generateSlotsInRange(timeStr, visitEndTime, 15);
        const conflictingVisit = wizytyNaDzien.find((wizyta) => {
          const existingStart = wizyta.godzina;
          const existingEnd = wizyta.godzina_do || addMinutesToTime(wizyta.godzina, 30);
          
          // Check if any slot in the range overlaps with existing visit
          return allSlotsInRange.some(slot => {
            const slotEnd = addMinutesToTime(slot, 15);
            return (slot < existingEnd && slotEnd > existingStart);
          });
        });
        
        if (conflictingVisit) {
          slots.push({
            time: timeStr,
            available: false,
            reason: `Zajęte (${conflictingVisit.godzina_od || conflictingVisit.godzina}-${conflictingVisit.godzina_do || addMinutesToTime(conflictingVisit.godzina, 30)})`
          });
        } else {
          slots.push({
            time: timeStr,
            available: true
          });
        }
      }
      
      // Add 15 minutes
      currentMin += 15;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour++;
      }
    }
    
    return slots;
  };

  // Check if date is a working day
  const isWorkingDay = (date: string): boolean => {
    if (!date || date.trim() === "") return false;
    const dateObj = new Date(date + "T00:00:00");
    if (isNaN(dateObj.getTime())) return false;
    const dayName = getDayName(dateObj);
    return planPracy[dayName]?.aktywny ?? false;
  };

  // Check if date is a vacation day
  const isVacationDay = (date: string): boolean => {
    if (!date || date.trim() === "") return false;
    const dateObj = new Date(date + "T00:00:00");
    if (isNaN(dateObj.getTime())) return false;
    return urlopy.some(urlop => {
      const startDate = new Date(urlop.data_od + "T00:00:00");
      const endDate = new Date(urlop.data_do + "T00:00:00");
      return dateObj >= startDate && dateObj <= endDate;
    });
  };

  // Check if date is available for appointments (working day and not vacation)
  const isDateAvailable = (date: string): boolean => {
    return isWorkingDay(date) && !isVacationDay(date);
  };

  // Get visit border color based on status
  const getVisitBorderColor = (status: VisitStatus): string => {
    switch (status) {
      case 'wykonana':
        return 'border-l-green-500';
      case 'odwolana':
        return 'border-l-red-500';
      case 'zaplanowana':
      default:
        return 'border-l-blue-500';
    }
  };

  // Get visit background color based on status
  const getVisitBackgroundColor = (status: VisitStatus): string => {
    switch (status) {
      case 'wykonana':
        return 'bg-green-50';
      case 'odwolana':
        return 'bg-red-50';
      case 'zaplanowana':
      default:
        return 'bg-white';
    }
  };

  // Check if time is within working hours
  const isWithinWorkingHours = (date: string, time: string): boolean => {
    if (!isWorkingDay(date)) return false;

    const dateObj = new Date(date + "T00:00:00");
    const dayName = getDayName(dateObj);
    const workingHours = planPracy[dayName]?.godziny;
    
    if (!workingHours) return false;

    const timeOnly = time.substring(0, 5); // Get HH:MM format
    return timeOnly >= workingHours.od && timeOnly <= workingHours.do;
  };

  // Check if time slot is available
  const isTimeSlotAvailable = (
    data: string,
    godzina: string,
    excludeId?: string,
    visitDuration?: '15min' | '30min' | 'custom',
    customStart?: string,
    customEnd?: string,
    customMinutes?: number,
  ) => {
    // Check if date is available (working day and not vacation)
    const dateAvailable = isDateAvailable(data);
    if (!dateAvailable) {
      console.log('❌ DEBUG - isTimeSlotAvailable: Data niedostępna', {
        data,
        isWorking: isWorkingDay(data),
        isVacation: isVacationDay(data)
      });
      return false;
    }

    // Check if it's within working hours
    const withinHours = isWithinWorkingHours(data, godzina);
    if (!withinHours) {
      const dateObj = new Date(data + "T00:00:00");
      const dayName = getDayName(dateObj);
      const workingHours = planPracy[dayName]?.godziny;
      console.log('❌ DEBUG - isTimeSlotAvailable: Poza godzinami pracy', {
        data,
        godzina,
        dayName,
        workingHours,
        timeOnly: godzina.substring(0, 5)
      });
      return false;
    }

    // Check if time hasn't passed (for today)
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const currentTime = format(now, "HH:mm:ss");
    
    if (data === todayStr && godzina <= currentTime) {
      console.log('❌ DEBUG - isTimeSlotAvailable: Wizyta w przeszłości', {
        data,
        todayStr,
        godzina,
        currentTime
      });
      return false;
    }

    // Calculate visit end time based on duration
    let visitEndTime: string;
    if (visitDuration === 'custom') {
      if (customStart && customEnd) {
        visitEndTime = customEnd + ':00';
      } else if (customMinutes) {
        visitEndTime = addMinutesToTime(godzina, customMinutes);
      } else {
        visitEndTime = addMinutesToTime(godzina, 60); // Default 60 minutes
      }
    } else {
      const minutes = visitDuration === '15min' ? 15 : 30;
      visitEndTime = addMinutesToTime(godzina, minutes);
    }

    // Check for time conflicts with existing visits (exclude cancelled visits)
    const activeVisits = wizyty.filter(w => w.status !== 'odwolana');
    const visitsForDate = activeVisits.filter(w => isSameDate(w.data, data));
    const hasConflict = visitsForDate.some((wizyta) => {
      if (wizyta.id === excludeId) {
        return false;
      }

      const existingStart = wizyta.godzina;
      const existingEnd = wizyta.godzina_do || addMinutesToTime(wizyta.godzina, 30);

      // Check if new visit overlaps with existing visit
      const newStart = godzina;
      const overlaps = (newStart < existingEnd && visitEndTime > existingStart);
      
      if (overlaps) {
        console.log('🔍 DEBUG - Konflikt znaleziony:', {
          newStart,
          newEnd: visitEndTime,
          existingStart,
          existingEnd,
          wizytaId: wizyta.id,
          wizytaStatus: wizyta.status
        });
      }
      
      return overlaps;
    });
    
    console.log('🔍 DEBUG - isTimeSlotAvailable:', {
      data,
      godzina,
      visitEndTime,
      activeVisitsCount: activeVisits.length,
      visitsForDateCount: visitsForDate.length,
      hasConflict,
      result: !hasConflict
    });
    
    return !hasConflict;
  };

  useEffect(() => {
    fetchPacjenci();
    fetchUrlopy();
    fetchPlanPracy();
  }, []);

  // Fetch wizyty when view or date changes
  useEffect(() => {
    if (selectedDate) {
      fetchWizyty();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedView, selectedDate]);

  const handleAddWizyta = () => {
    setSelectedWizyta(null);
    setSelectedPacjent(null);
    setSearchQuery("");
    setSearchResults([]);
    
    // Reset custom fields
    setVisitDuration('30min');
    setCustomDurationMinutes(60);
    setCustomStartTime('08:00');
    setCustomEndTime('09:00');
    
    const selectedDateStr = selectedDate
      ? format(selectedDate, "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd");
    
    // Get first available hour from work schedule
    const workingHours = generateWorkingHours(selectedDateStr);
    const firstAvailableHour = workingHours.length > 0 ? workingHours[0] : "08:00:00";
    
    setNowaWizyta({
      data: selectedDateStr,
      godzina: firstAvailableHour,
      godzina_od: firstAvailableHour,
      godzina_do: addMinutesToTime(firstAvailableHour, 30),
      rodzaj: "LECZENIE",
      notatki: "",
      status: "zaplanowana",
    });
    setError(null);
    setIsDialogOpen(true);
  };

  const handleEditWizyta = (wizyta: WizytaWithPacjent) => {
    setSelectedWizyta(wizyta);
    setSelectedPacjent(wizyta.pacjenci);
    setSearchQuery(`${wizyta.pacjenci.imie} ${wizyta.pacjenci.nazwisko}`);
    setSearchResults([]);
    
    // Determine visit duration based on existing times
    const startTime = wizyta.godzina;
    const endTime = wizyta.godzina_do || addMinutesToTime(wizyta.godzina, 30);
    const duration = calculateDuration(startTime, endTime);
    
    if (duration === 15) {
      setVisitDuration('15min');
    } else if (duration === 30) {
      setVisitDuration('30min');
    } else {
      setVisitDuration('custom');
      setCustomStartTime(startTime.substring(0, 5));
      setCustomEndTime(endTime.substring(0, 5));
    }
    
    setNowaWizyta({
      pacjent_id: wizyta.pacjent_id,
      data: wizyta.data,
      godzina: wizyta.godzina,
      godzina_od: startTime,
      godzina_do: endTime,
      rodzaj: wizyta.rodzaj,
      notatki: wizyta.notatki,
      status: wizyta.status || "zaplanowana",
    });
    setError(null);
    setIsDialogOpen(true);
  };

  const handleDeleteWizyta = (wizyta: WizytaWithPacjent) => {
    setSelectedWizyta(wizyta);
    setIsDeleteDialogOpen(true);
  };

  const handleWizytaClick = (wizyta: WizytaWithPacjent) => {
    if (onPatientSelect) {
      onPatientSelect(wizyta.pacjenci.id);
    }
  };

  const handleUpdateVisitStatus = async (wizyta: WizytaWithPacjent, status: VisitStatus) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("wizyty")
        .update({ status })
        .eq("id", wizyta.id);

      if (error) throw error;

      // Refresh wizyty for the date of updated visit
      if (wizyta.data) {
        await refreshWizytyForDate(wizyta.data);
      } else {
        await fetchWizyty();
      }
    } catch (err) {
      console.error("Error updating visit status:", err);
      setError("Błąd podczas aktualizacji statusu wizyty");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!selectedWizyta) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("wizyty")
        .delete()
        .eq("id", selectedWizyta.id);

      if (error) throw error;

      // Refresh wizyty for the date of deleted visit
      if (selectedWizyta?.data) {
        await refreshWizytyForDate(selectedWizyta.data);
      } else {
        await fetchWizyty();
      }
      
      // Pokaż komunikat sukcesu
      setSuccessMessage("Wizyta została usunięta pomyślnie!");
      setShowSuccessDialog(true);
      
      setIsDeleteDialogOpen(false);
      setSelectedWizyta(null);
    } catch (err) {
      console.error("Error deleting wizyta:", err);
      setError("Błąd podczas usuwania wizyty");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWizyta = async () => {
    console.log('🔍 DEBUG - handleSaveWizyta START:', {
      nowaWizyta,
      selectedWizyta: selectedWizyta?.id,
      visitDuration,
      customStartTime,
      customEndTime,
      customDurationMinutes
    });
    
    // Check if patient is selected
    if (!nowaWizyta.pacjent_id) {
      console.log('❌ DEBUG - Brak pacjenta');
      setError("❌ Proszę wybrać pacjenta przed dodaniem wizyty");
      setShowPatientError(true);
      return;
    }
    
    // Clear patient error if patient is selected
    setShowPatientError(false);

    // Check other required fields
    if (
      !nowaWizyta.data ||
      !nowaWizyta.godzina ||
      !nowaWizyta.rodzaj
    ) {
      console.log('❌ DEBUG - Brakuje wymaganych pól:', {
        data: nowaWizyta.data,
        godzina: nowaWizyta.godzina,
        rodzaj: nowaWizyta.rodzaj
      });
      setError("Wszystkie pola są wymagane");
      return;
    }

    // Additional validation: check for overlapping visits using godzina_od and godzina_do
    const newStart = nowaWizyta.godzina_od || nowaWizyta.godzina;
    const newEnd = nowaWizyta.godzina_do || addMinutesToTime(nowaWizyta.godzina, 30);
    
    const hasOverlap = wizyty.filter(w => w.status !== 'odwolana').some((wizyta) => {
      // Użyj porównania dat zamiast stringów
      if (!isSameDate(wizyta.data, nowaWizyta.data) || wizyta.id === selectedWizyta?.id) {
        return false;
      }
      
      const existingStart = wizyta.godzina;
      const existingEnd = wizyta.godzina_do || addMinutesToTime(wizyta.godzina, 30);
      
      // Check if visits overlap
      return (newStart < existingEnd && newEnd > existingStart);
    });
    
    if (hasOverlap) {
      console.log('❌ DEBUG - Konflikt terminów (hasOverlap)');
      setError("❌ Wybrany termin koliduje z istniejącą wizytą");
      return;
    }

    // Check if time slot is available
    // Check if time slot is available (includes working hours and vacation check)
    const isSlotAvailable = isTimeSlotAvailable(
      nowaWizyta.data,
      nowaWizyta.godzina_od || nowaWizyta.godzina,
      selectedWizyta?.id,
      visitDuration,
      customStartTime,
      customEndTime,
      customDurationMinutes,
    );
    
    console.log('🔍 DEBUG - Sprawdzanie dostępności terminu:', {
      data: nowaWizyta.data,
      godzina: nowaWizyta.godzina_od || nowaWizyta.godzina,
      visitDuration,
      isSlotAvailable,
      hasOverlap,
      wizytyNaDzien: wizyty.filter(w => isSameDate(w.data, nowaWizyta.data) && w.status !== 'odwolana').length
    });
    
    if (!isSlotAvailable) {
      console.log('❌ DEBUG - Termin niedostępny (isSlotAvailable = false)');
      // Check if time has passed (for today)
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const currentTime = format(now, "HH:mm:ss");
      
      if (isSameDate(nowaWizyta.data, todayStr) && nowaWizyta.godzina <= currentTime) {
        console.log('❌ DEBUG - Wizyta w przeszłości');
        setError("❌ Nie można dodać wizyty w przeszłości");
      } else if (isVacationDay(nowaWizyta.data)) {
        console.log('❌ DEBUG - Dzień urlopowy');
        setTimeSlotWarningMessage('⚠️ Wybrany dzień jest dniem wolnym (urlop)');
        setTimeSlotWarningDialog(true);
      } else if (!isWorkingDay(nowaWizyta.data)) {
        console.log('❌ DEBUG - Nie dzień roboczy');
        setTimeSlotWarningMessage('⚠️ Wybrany dzień nie jest dniem roboczym');
        setTimeSlotWarningDialog(true);
      } else if (!isWithinWorkingHours(nowaWizyta.data, nowaWizyta.godzina)) {
        console.log('❌ DEBUG - Poza godzinami pracy');
        const dayName = getDayName(new Date(nowaWizyta.data + "T00:00:00"));
        const daySchedule = planPracy[dayName];
        if (daySchedule) {
          setTimeSlotWarningMessage(`⚠️ Godzina poza planem pracy (${daySchedule.godziny.od} - ${daySchedule.godziny.do})`);
          setTimeSlotWarningDialog(true);
        } else {
          setTimeSlotWarningMessage('⚠️ Godzina poza planem pracy');
          setTimeSlotWarningDialog(true);
        }
      } else if (visitDuration === 'custom' && customDurationMinutes) {
        console.log('❌ DEBUG - Custom wizyta nie mieści się w planie pracy');
        const visitEndTime = addMinutesToTime(nowaWizyta.godzina, customDurationMinutes);
        const dayName = getDayName(new Date(nowaWizyta.data + "T00:00:00"));
        const daySchedule = planPracy[dayName];
        if (daySchedule) {
          const [endHour, endMin] = visitEndTime.split(':').map(Number);
          const [workEndHour, workEndMin] = daySchedule.godziny.do.split(':').map(Number);
          if (endHour > workEndHour || (endHour === workEndHour && endMin > workEndMin)) {
            setTimeSlotWarningMessage(`⚠️ Wizyta ${customDurationMinutes} min nie mieści się w planie pracy (do ${daySchedule.godziny.do})`);
            setTimeSlotWarningDialog(true);
          } else {
            setTimeSlotWarningMessage('⚠️ Wybrany termin nie jest dostępny - sprawdź konflikty z innymi wizytami');
            setTimeSlotWarningDialog(true);
          }
        } else {
          setTimeSlotWarningMessage('⚠️ Wybrany termin nie jest dostępny');
          setTimeSlotWarningDialog(true);
        }
      } else {
        console.log('❌ DEBUG - Ogólny błąd dostępności terminu');
        setTimeSlotWarningMessage('⚠️ Wybrany termin nie jest dostępny - sprawdź konflikty z innymi wizytami');
        setTimeSlotWarningDialog(true);
      }
      return;
    }

    console.log('✅ DEBUG - Przechodzę do zapisu wizyty');
    setLoading(true);
    setError(null);

    try {
      if (selectedWizyta) {
        // Update existing wizyta
        const { error } = await supabase
          .from("wizyty")
          .update({
            pacjent_id: nowaWizyta.pacjent_id,
            data: nowaWizyta.data,
            godzina: nowaWizyta.godzina,
            godzina_od: nowaWizyta.godzina_od,
            godzina_do: nowaWizyta.godzina_do,
            rodzaj: nowaWizyta.rodzaj,
            notatki: nowaWizyta.notatki || "",
            status: nowaWizyta.status || "zaplanowana",
          })
          .eq("id", selectedWizyta.id);

        if (error) throw error;
      } else {
        // Insert new wizyta
        const { error } = await supabase.from("wizyty").insert({
          pacjent_id: nowaWizyta.pacjent_id,
          data: nowaWizyta.data,
          godzina: nowaWizyta.godzina,
          godzina_od: nowaWizyta.godzina_od,
          godzina_do: nowaWizyta.godzina_do,
          rodzaj: nowaWizyta.rodzaj,
          notatki: nowaWizyta.notatki || "",
          status: nowaWizyta.status || "zaplanowana",
        });

        if (error) throw error;
      }

      console.log('✅ DEBUG - Wizyta zapisana pomyślnie');
      // Refresh wizyty for the date of saved visit
      if (nowaWizyta.data) {
        await refreshWizytyForDate(nowaWizyta.data);
      } else {
        await fetchWizyty();
      }
      
      // Pokaż komunikat sukcesu
      setSuccessMessage(selectedWizyta ? "Wizyta została zaktualizowana pomyślnie!" : "Wizyta została dodana pomyślnie!");
      setShowSuccessDialog(true);
      
      setIsDialogOpen(false);
      // Wyczyść formularz po zapisaniu
      setNowaWizyta({
        data: selectedDate
          ? format(selectedDate, "yyyy-MM-dd")
          : format(new Date(), "yyyy-MM-dd"),
        godzina: "08:00:00",
        rodzaj: "LECZENIE",
        notatki: "",
      });
      setSelectedWizyta(null);
      setSelectedPacjent(null);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err: any) {
      console.error("❌ DEBUG - Error saving wizyta:", err);
      if (err.code === "23505") {
        setError("Ten termin jest już zajęty. Wybierz inną godzinę.");
      } else {
        setError("Błąd podczas zapisywania wizyty");
      }
    } finally {
      console.log('🔚 DEBUG - handleSaveWizyta END');
      setLoading(false);
    }
  };

  const wizytyNaDzien = wizyty
    .filter((wizyta) => {
      if (!selectedDate) return false;
      const wizytaDate = new Date(wizyta.data + "T00:00:00");
      return (
        wizytaDate.getDate() === selectedDate.getDate() &&
        wizytaDate.getMonth() === selectedDate.getMonth() &&
        wizytaDate.getFullYear() === selectedDate.getFullYear()
      );
    })
    .sort((a, b) => a.godzina.localeCompare(b.godzina));

  // Funkcje pomocnicze dla widoków (zdefiniowane wcześniej, przed fetchWizyty)

  const getWizytyForDate = (date: Date) => {
    return wizyty
      .filter((wizyta) => {
        // Użyj tej samej logiki co wizytyNaDzien (która działa!)
        const wizytaDate = new Date(wizyta.data + "T00:00:00");
        return (
          wizytaDate.getDate() === date.getDate() &&
          wizytaDate.getMonth() === date.getMonth() &&
          wizytaDate.getFullYear() === date.getFullYear()
        );
      })
      .sort((a, b) => a.godzina.localeCompare(b.godzina));
  };

  const weekDates = selectedDate ? getWeekDates(selectedDate) : [];
  const monthDates = selectedDate ? getMonthDates(selectedDate) : [];
  const monthPreviewDates = getMonthDates(monthPreviewDate);

  useEffect(() => {
    if (!isMonthPreviewOpen) return;

    const startDate = format(monthPreviewDates[0], "yyyy-MM-dd");
    const endDate = format(
      monthPreviewDates[monthPreviewDates.length - 1],
      "yyyy-MM-dd",
    );

    fetchWizytyForRange(
      startDate,
      endDate,
      `month-preview-${format(monthPreviewDate, "yyyy-MM")}`,
    );
  }, [isMonthPreviewOpen, monthPreviewDate]);

  // Funkcje nawigacji
  const goToPreviousWeek = () => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() - 7);
      setSelectedDate(newDate);
    }
  };

  const goToNextWeek = () => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + 7);
      setSelectedDate(newDate);
    }
  };

  const goToPreviousMonth = () => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() - 1);
      setSelectedDate(newDate);
    }
  };

  const goToNextMonth = () => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() + 1);
      setSelectedDate(newDate);
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Funkcja do wydruku wizyt dla wybranego dnia
  const handlePrintSelectedDayVisits = async () => {
    if (!selectedDate) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const displayDateStr = format(selectedDate, "EEEE, d MMMM yyyy", { locale: pl });
    
    // Pobierz wizyty dodatkowe dla wybranego dnia
    let dodatkoweContent = '';
    try {
      const { data: dodatkoweData } = await supabase
        .from('wizyty_dodatkowe_pacjenci_view')
        .select('imie, nazwisko, rodzaj, notatki, status')
        .eq('data', dateStr)
        .neq('status', 'anulowana');

      if (dodatkoweData && dodatkoweData.length > 0) {
        dodatkoweContent = dodatkoweData
          .map((w) => `- ${w.imie} ${w.nazwisko}: ${w.rodzaj}${w.notatki ? ` (${w.notatki})` : ''} [${w.status}]`)
          .join('\n');
      }
    } catch (err) {
      console.error('Error fetching additional visits for print:', err);
    }

    // Pobierz notatkę dla wybranego dnia
    let noteContent = '';
    try {
      const { data: noteData } = await supabase
        .from('notatki_dzienne')
        .select('tresc')
        .eq('data', dateStr)
        .maybeSingle();

      if (noteData) {
        noteContent = noteData.tresc;
      }
    } catch (err) {
      console.error('Error fetching note for print:', err);
    }
    
    // Debug: sprawdź dane wizyt przed drukowaniem
    console.log('🔍 DEBUG - Wizyty do druku:', wizytyNaDzien.map(w => ({
      pacjent: `${w.pacjenci?.imie} ${w.pacjenci?.nazwisko}`,
      telefon: w.pacjenci?.telefon,
      hasTelefon: !!w.pacjenci?.telefon,
      pacjenci: w.pacjenci
    })));
    
    // Przygotuj zawartość do wydruku
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Wizyty na dzień ${displayDateStr}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .clinic-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .date {
              font-size: 16px;
              color: #666;
            }
            .visit-item {
              display: flex;
              flex-direction: column;
              padding: 10px 0;
              border-bottom: 1px solid #eee;
            }
            .visit-time {
              font-weight: bold;
              margin-bottom: 8px;
            }
            .visit-patient {
              flex: 1;
            }
            .visit-patient-name {
              display: flex;
              align-items: center;
              margin-bottom: 4px;
            }
            .visit-patient-name-text {
              font-weight: 500;
            }
            .visit-phone {
              color: #666;
              font-size: 14px;
              margin-left: 20px;
            }
            .visit-type {
              color: #666;
              font-size: 14px;
              margin-bottom: 4px;
            }
            .visit-notes {
              color: #333;
              font-size: 12px;
              font-style: italic;
              margin-top: 4px;
            }
            .visit-status {
              min-width: 100px;
              text-align: right;
              font-size: 12px;
              padding: 2px 8px;
              border-radius: 4px;
            }
            .status-zaplanowana {
              background-color: #e3f2fd;
              color: #1976d2;
            }
            .status-wykonana {
              background-color: #e8f5e8;
              color: #2e7d32;
            }
            .status-odwolana {
              background-color: #ffebee;
              color: #c62828;
            }
            .summary {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 2px solid #333;
              text-align: center;
              font-weight: bold;
            }
            .note-section {
              margin-top: 30px;
              padding: 15px;
              background-color: #f9f9f9;
              border: 1px solid #ddd;
              border-radius: 8px;
            }
            .note-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #333;
            }
            .note-content {
              white-space: pre-wrap;
              line-height: 1.6;
              color: #333;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-name">KARTOTEKA</div>
            <div class="date">WIZYTY NA DZIEŃ: ${displayDateStr}</div>
          </div>
          
          ${wizytyNaDzien.length > 0 ? 
            wizytyNaDzien.map(wizyta => `
              <div class="visit-item">
                <div class="visit-time">${wizyta.godzina_od ? wizyta.godzina_od.substring(0, 5) : wizyta.godzina.substring(0, 5)}${wizyta.godzina_do ? '-' + wizyta.godzina_do.substring(0, 5) : ''}</div>
                <div class="visit-patient">
                  <div class="visit-patient-name">
                    <span class="visit-patient-name-text">${wizyta.pacjenci.imie} ${wizyta.pacjenci.nazwisko}</span>
                    ${wizyta.pacjenci.telefon && wizyta.pacjenci.telefon.trim() ? `<span class="visit-phone">tel: ${wizyta.pacjenci.telefon}</span>` : ''}
                  </div>
                  <div class="visit-type">${wizyta.rodzaj}</div>
                  ${wizyta.notatki ? `
                    <div class="visit-notes">+ ${wizyta.notatki}</div>
                  ` : ''}
                </div>
              </div>
            `).join('') : 
            '<div style="text-align: center; padding: 40px; color: #666;">Brak wizyt na wybrany dzień</div>'
          }
          
          <div class="summary">
            RAZEM: ${wizytyNaDzien.length} wizyt
          </div>

          ${dodatkoweContent ? `
            <div class="note-section">
              <div class="note-title">+ Wizyty dodatkowe:</div>
              <div class="note-content">${dodatkoweContent}</div>
            </div>
          ` : ''}

          ${noteContent ? `
            <div class="note-section">
              <div class="note-title">+ Notatka:</div>
              <div class="note-content">${noteContent}</div>
            </div>
          ` : ''}
        </body>
      </html>
    `;

    // Otwórz nowe okno z zawartością do wydruku
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Poczekaj na załadowanie i otwórz dialog drukowania
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };
    }
  };



  // Vacation management functions
  const handleAddVacation = () => {
    setSelectedUrlop(null);
    setNowyUrlop({
      data_od: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      data_do: selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      opis: "",
    });
    setIsVacationDialogOpen(true);
  };

  const handleEditVacation = (urlop: Urlop) => {
    setSelectedUrlop(urlop);
    setNowyUrlop({
      data_od: urlop.data_od,
      data_do: urlop.data_do,
      opis: urlop.opis || "",
    });
    setIsVacationDialogOpen(true);
  };

  const handleDeleteVacation = async (urlop: Urlop) => {
    if (!confirm(`Czy na pewno chcesz usunąć urlop od ${urlop.data_od} do ${urlop.data_do}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("urlopy")
        .delete()
        .eq("id", urlop.id);

      if (error) throw error;

      await fetchUrlopy();
    } catch (err) {
      console.error("Error deleting vacation:", err);
      setError("Błąd podczas usuwania urlopu");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVacation = async () => {
    if (!nowyUrlop.data_od || !nowyUrlop.data_do) {
      setError("Wszystkie pola są wymagane");
      return;
    }

    if (new Date(nowyUrlop.data_od) > new Date(nowyUrlop.data_do)) {
      setError("Data końcowa nie może być wcześniejsza niż data początkowa");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (selectedUrlop) {
        // Update existing vacation
        const { error } = await supabase
          .from("urlopy")
          .update({
            data_od: nowyUrlop.data_od,
            data_do: nowyUrlop.data_do,
            opis: nowyUrlop.opis || "",
          })
          .eq("id", selectedUrlop.id);

        if (error) throw error;
      } else {
        // Insert new vacation
        const { error } = await supabase
          .from("urlopy")
          .insert({
            data_od: nowyUrlop.data_od,
            data_do: nowyUrlop.data_do,
            opis: nowyUrlop.opis || "",
          });

        if (error) throw error;
      }

      await fetchUrlopy();
      setIsVacationDialogOpen(false);
      setNowyUrlop({
        data_od: format(new Date(), "yyyy-MM-dd"),
        data_do: format(new Date(), "yyyy-MM-dd"),
        opis: "",
      });
      setSelectedUrlop(null);
    } catch (err: any) {
      console.error("Error saving vacation:", err);
      setError(`Błąd podczas zapisywania urlopu: ${err.message || err.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWorkSchedule = async () => {
    setLoading(true);
    setError(null);

    try {
      // Zapisz każdy dzień tygodnia do bazy danych
      const updates = Object.entries(tempPlanPracy).map(([dzien, plan]) => ({
        dzien_tygodnia: dzien,
        godzina_od: plan.godziny.od + ':00',
        godzina_do: plan.godziny.do + ':00',
        aktywny: plan.aktywny,
        updated_at: new Date().toISOString()
      }));

      // Użyj upsert aby zaktualizować istniejące rekordy lub utworzyć nowe
      const { error } = await supabase
        .from('plany_pracy')
        .upsert(updates, { 
          onConflict: 'dzien_tygodnia',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      // Aktualizuj lokalny stan
      setPlanPracy(tempPlanPracy);
      setIsWorkScheduleDialogOpen(false);
      
    } catch (err: any) {
      console.error('Error saving work schedule:', err);
      setError(`Błąd podczas zapisywania planu pracy: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const znajdzNajblizszeTerminy = async (
    startDate: Date = new Date(),
    limit: number = 10,
    startTimeIndex: number = 0,
    append: boolean = false,
    overrideDuration?: '15min' | '30min',
  ) => {
    setSearchingSlots(true);
    setError(null);

    try {
      const slots: Array<{ date: string; time: string; displayDate: string }> =
        [];
      let currentDate = new Date(startDate);
      let daysChecked = 0;
      const maxDaysToCheck = 60;
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const currentTime = format(now, "HH:mm:ss");
      let currentTimeIndex = startTimeIndex;
      let isFirstDay = true;
      
      // Użyj overrideDuration jeśli podano, w przeciwnym razie użyj state
      const activeDuration = overrideDuration || slotDuration;

      // Pobierz wizyty dla zakresu dat (startDate do startDate + maxDaysToCheck dni)
      const endSearchDate = new Date(startDate);
      endSearchDate.setDate(endSearchDate.getDate() + maxDaysToCheck);
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endSearchDate, "yyyy-MM-dd");
      
      const { data: allVisits, error: visitsError } = await supabase
        .from("wizyty")
        .select(`*, pacjenci (*)`)
        .gte("data", startDateStr)
        .lte("data", endDateStr)
        .neq("status", "odwolana")
        .order("data")
        .order("godzina");
      
      if (visitsError) throw visitsError;
      
      // Konwertuj na format WizytaWithPacjent
      const allVisitsFormatted: WizytaWithPacjent[] = (allVisits || []).map(v => ({
        ...v,
        pacjenci: v.pacjenci as Pacjent
      }));

      while (slots.length < limit && daysChecked < maxDaysToCheck) {
        const dataStr = format(currentDate, "yyyy-MM-dd");
        if (isDateAvailable(dataStr)) {
          // Użyj wizyt pobranych z bazy dla tego dnia
          const wizytyNaDzien = allVisitsFormatted.filter((w) => isSameDate(w.data, dataStr));
          const workingHours = generateWorkingHours(dataStr, activeDuration, undefined, wizytyNaDzien);
          
          let wolneGodziny = workingHours;

          if (dataStr === todayStr) {
            wolneGodziny = wolneGodziny.filter(godzina => godzina > currentTime);
          }

          // Dla pierwszego dnia: zacznij od currentTimeIndex
          // Dla kolejnych dni: zacznij od indeksu 0
          const startIdx = isFirstDay ? currentTimeIndex : 0;
          
          // Dodaj wolne godziny zaczynając od właściwego indeksu
          for (let i = startIdx; i < wolneGodziny.length && slots.length < limit; i++) {
            const godzina = wolneGodziny[i];
            slots.push({
              date: dataStr,
              time: godzina,
              displayDate: format(currentDate, "EEEE, d MMMM yyyy", {
                locale: pl,
              }),
            });
            currentTimeIndex = i + 1;
          }

          // Jeśli wykorzystaliśmy wszystkie godziny z tego dnia, zresetuj indeks i przejdź do następnego dnia
          if (currentTimeIndex >= wolneGodziny.length) {
            currentTimeIndex = 0;
            currentDate.setDate(currentDate.getDate() + 1);
          }
          // Jeśli osiągnęliśmy limit w trakcie dnia, zostajemy w tym samym dniu
          else if (slots.length >= limit) {
            break;
          }
        } else {
          // Jeśli dzień niedostępny, przejdź do następnego
          currentDate.setDate(currentDate.getDate() + 1);
          currentTimeIndex = 0;
        }

        isFirstDay = false;
        daysChecked++;
      }

      // Dodaj do istniejących slotów jeśli append=true, w przeciwnym razie zastąp
      if (append) {
        setAvailableSlots(prev => [...prev, ...slots]);
      } else {
        setAvailableSlots(slots);
      }
      
      setCurrentSearchDate(new Date(currentDate));
      setCurrentSearchTimeIndex(currentTimeIndex);
    } catch (err) {
      console.error("Error finding available slots:", err);
      setError("Błąd podczas wyszukiwania wolnych terminów");
    } finally {
      setSearchingSlots(false);
    }
  };

  const znajdzKolejneTerminy = () => {
    znajdzNajblizszeTerminy(currentSearchDate, 10, currentSearchTimeIndex, true, slotDuration);
  };

  const selectTimeSlot = (date: string, time: string) => {
    setSelectedPacjent(null);
    setSearchQuery("");
    setSearchResults([]);
    
    // Ustaw visitDuration na podstawie slotDuration
    setVisitDuration(slotDuration);
    
    // Oblicz czasy wizyty na podstawie wybranego slotu
    const visitTimes = updateVisitTimes(time, slotDuration);
    
    setNowaWizyta({
      ...nowaWizyta,
      data: date,
      ...visitTimes,
    });
    
    setSelectedDate(new Date(date + "T00:00:00"));
    setIsDialogOpen(true);
  };

  const handleMonthPreviewSlotClick = (date: Date, slot: string) => {
    const slotInfo = getMonthPreviewSlotState(date, slot);
    const dateStr = format(date, "yyyy-MM-dd");

    if (slotInfo.state === "free") {
      setSelectedWizyta(null);
      setSelectedPacjent(null);
      setSearchQuery("");
      setSearchResults([]);
      setVisitDuration("15min");

      const timeStr = `${slot}:00`;
      const visitTimes = updateVisitTimes(timeStr, "15min");

      setNowaWizyta({
        data: dateStr,
        ...visitTimes,
        rodzaj: "LECZENIE",
        notatki: "",
        status: "zaplanowana",
      });
      setSelectedDate(date);
      setIsMonthPreviewOpen(false);
      setIsDialogOpen(true);
      return;
    }

    if (slotInfo.visit) {
      setSelectedDate(date);
      setSelectedView("dzien");
      setHighlightedWizytaId(slotInfo.visit.id);
      setIsMonthPreviewOpen(false);
    }
  };

  useEffect(() => {
    if (!highlightedWizytaId || selectedView !== "dzien") return;

    const scrollTimer = setTimeout(() => {
      const element = document.getElementById(`wizyta-${highlightedWizytaId}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);

    const clearTimer = setTimeout(() => {
      setHighlightedWizytaId(null);
    }, 3000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightedWizytaId, selectedView]);

  // Inicjalne wyszukanie terminów
  useEffect(() => {
    if (wizyty.length > 0) {
      znajdzNajblizszeTerminy(new Date(), 10, 0, false, slotDuration);
    }
  }, [wizyty]);

  // Search for patients - ONLY when user explicitly requests it via button
  // useEffect removed - no automatic searching

  return (
    <div className="bg-white p-4 rounded-lg shadow-md w-full">
      {error && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Panel boczny z kalendarzem */}
        <div className="md:w-1/3">
          <Card>
            <CardHeader>
              <CardTitle>Kalendarz</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border w-full"
                locale={pl}
                weekStartsOn={1}
              />
              <div className="mt-4 space-y-2">
                <Button
                  onClick={handleAddWizyta}
                  className="w-full"
                  disabled={loading}
                >
                  <Plus className="mr-2 h-4 w-4" /> Dodaj wizytę
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsWorkScheduleDialogOpen(true)}
                  className="w-full"
                  disabled={loading}
                >
                  <Settings className="mr-2 h-4 w-4" /> Plan pracy
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAddVacation}
                  className="w-full"
                  disabled={loading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" /> Zarządzaj urlopami
                </Button>
                <Button
                  variant="outline"
                  onClick={() => znajdzNajblizszeTerminy(new Date(), 10, 0, false, slotDuration)}
                  className="w-full"
                  disabled={loading || searchingSlots}
                >
                  <Search className="mr-2 h-4 w-4" />
                  {searchingSlots
                    ? "Wyszukiwanie..."
                    : "Znajdź najbliższe terminy"}
                </Button>
              </div>

              {/* Sekcja z dostępnymi terminami */}
              {availableSlots.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">
                      Najbliższe wolne terminy
                    </h3>
                    
                    {/* Przełącznik 15min/30min */}
                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                      <span className={`text-sm font-medium transition-colors ${
                        slotDuration === '15min' ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        15 min
                      </span>
                      <Switch
                        checked={slotDuration === '30min'}
                        onCheckedChange={(checked) => {
                          const newDuration = checked ? '30min' : '15min';
                          setSlotDuration(newDuration);
                          znajdzNajblizszeTerminy(new Date(), 10, 0, false, newDuration);
                        }}
                      />
                      <span className={`text-sm font-medium transition-colors ${
                        slotDuration === '30min' ? 'text-blue-600' : 'text-gray-500'
                      }`}>
                        30 min
                      </span>
                    </div>
                  </div>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-2">
                      {availableSlots.map((slot, index) => (
                        <Card
                          key={`${slot.date}-${slot.time}-${index}`}
                          className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => selectTimeSlot(slot.date, slot.time)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium text-sm">
                                {slot.displayDate}
                              </p>
                              <p className="text-sm text-gray-600">
                                {slot.time.substring(0, 5)}
                              </p>
                            </div>
                            <Button size="sm" variant="ghost">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>

                  <Button
                    variant="outline"
                    onClick={znajdzKolejneTerminy}
                    className="w-full mt-4"
                    disabled={searchingSlots}
                  >
                    {searchingSlots
                      ? "Wyszukiwanie..."
                      : "Pokaż kolejne 10 terminów"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Główny panel z wizytami */}
        <div className="md:w-2/3">
          <Card>
            <CardHeader>
              <div className="flex justify-end items-center gap-2 flex-wrap">
                <Tabs
                  value={selectedView}
                  onValueChange={setSelectedView}
                  className="w-auto"
                >
                  <TabsList className="w-auto">
                    <TabsTrigger value="dzien">Dzień</TabsTrigger>
                    <TabsTrigger value="tydzien">Tydzień</TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  className="shrink-0"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMonthPreviewDate(selectedDate || new Date());
                    setIsMonthPreviewOpen(true);
                  }}
                  disabled={loading}
                >
                  Podgląd miesiąca
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs
                value={selectedView}
                onValueChange={setSelectedView}
                className="w-full"
              >
                <TabsContent value="dzien" className="mt-0 h-[calc(100vh-280px)]">
                  <div className="flex flex-col h-full">
                    <div className="flex-shrink-0 text-center">
                      {!selectedDate ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                          <h3 className="text-sm font-medium text-gray-600">
                            Wybierz datę
                          </h3>
                          <p className="text-xs text-gray-500">Wybierz dzień z kalendarza</p>
                        </div>
                      ) : isVacationDay(selectedDateStr) ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                          <h3 className="text-sm font-medium text-red-600">
                            {format(selectedDate, "EEEE, d MMMM yyyy", { locale: pl })}
                          </h3>
                          <p className="text-xs text-red-500">Dzień urlopowy - klinika nie pracuje</p>
                        </div>
                      ) : isWorkingDay(selectedDateStr) ? (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                          <h3 className="text-sm font-medium text-green-600">
                            {format(selectedDate, "EEEE, d MMMM yyyy", { locale: pl })}
                          </h3>
                          <p className="text-xs text-green-600">
                            Godziny pracy: {planPracy[getDayName(selectedDate)]?.godziny?.od || 'N/A'} - {planPracy[getDayName(selectedDate)]?.godziny?.do || 'N/A'}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                          <h3 className="text-sm font-medium text-gray-600">
                            {format(selectedDate, "EEEE, d MMMM yyyy", { locale: pl })}
                          </h3>
                          <p className="text-xs text-gray-500">Dzień wolny od pracy</p>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex justify-between items-center mb-2 mt-2">
                      <h3 className="text-base font-medium">Wizyty na wybrany dzień</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrintSelectedDayVisits}
                        className="flex items-center space-x-1 h-7 px-2"
                      >
                        <Printer className="h-3 w-3" />
                        <span className="text-xs">Drukuj</span>
                      </Button>
                    </div>
                    
                    {/* WIZYTY - ScrollArea z jedną wizytą w wierszu */}
                    <div className="flex-1 min-h-0 mb-2">
                      <ScrollArea className="h-full">
                        {wizytyNaDzien.length > 0 ? (
                          <div className="space-y-3 pr-4">
                            {wizytyNaDzien.map((wizyta) => (
                              <Card
                                key={wizyta.id}
                                id={`wizyta-${wizyta.id}`}
                                className={`border-l-4 ${getVisitBorderColor((wizyta.status || 'zaplanowana') as VisitStatus)} cursor-pointer hover:shadow-md transition-all duration-200 ${getVisitBackgroundColor((wizyta.status || 'zaplanowana') as VisitStatus)} ${highlightedWizytaId === wizyta.id ? "ring-2 ring-yellow-400 shadow-lg" : ""}`}
                                onClick={() => handleWizytaClick(wizyta)}
                                title={`Kliknij aby przejść do karty pacjenta: ${wizyta.pacjenci.imie} ${wizyta.pacjenci.nazwisko}`}
                              >
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-start gap-4">
                                    <div className="flex-1">
                                      <div className="flex items-center mb-2">
                                        <Clock className="mr-2 text-gray-500 flex-shrink-0 h-4 w-4" />
                                        <span className="font-medium text-sm">
                                          {wizyta.godzina.substring(0, 5)}
                                          {wizyta.godzina_do && (
                                            <span className="text-gray-500 ml-2">
                                              - {wizyta.godzina_do.substring(0, 5)}
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <h4 className="font-semibold text-lg hover:text-blue-600 transition-colors">
                                          {wizyta.pacjenci.imie} {wizyta.pacjenci.nazwisko}
                                        </h4>
                                        <div className="flex items-center text-gray-600 text-sm">
                                          <Phone className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                                          <span>{wizyta.pacjenci.telefon}</span>
                                        </div>
                                      </div>
                                      <p className="text-gray-600 text-sm mt-1">
                                        {wizyta.rodzaj}
                                      </p>
                                      {wizyta.notatki && (
                                        <p className="text-gray-500 text-xs mt-2 italic">
                                          {wizyta.notatki}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex flex-col space-y-2" onClick={(e) => e.stopPropagation()}>
                                      {/* Przyciski statusów - różne opcje w zależności od aktualnego statusu */}
                                      <div className="flex space-x-2">
                                        {/* ZAPLANOWANA: pokaż [Wykonana] [Odwołana] */}
                                        {(wizyta.status === 'zaplanowana' || !wizyta.status) && (
                                          <>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleUpdateVisitStatus(wizyta, 'wykonana' as VisitStatus)}
                                              disabled={loading}
                                              className="text-green-600 hover:text-green-700"
                                              title="Oznacz wizytę jako wykonana"
                                            >
                                              <CheckCircle className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleUpdateVisitStatus(wizyta, 'odwolana' as VisitStatus)}
                                              disabled={loading}
                                              className="text-red-600 hover:text-red-700"
                                              title="Anuluj wizytę"
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </>
                                        )}
                                        
                                        {/* WYKONANA: pokaż [Cofnij] */}
                                        {wizyta.status === 'wykonana' && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleUpdateVisitStatus(wizyta, 'zaplanowana' as VisitStatus)}
                                            disabled={loading}
                                            className="text-blue-600 hover:text-blue-700"
                                            title="Cofnij do statusu zaplanowana"
                                          >
                                            <RotateCcw className="h-4 w-4" />
                                          </Button>
                                        )}
                                        
                                        {/* ODWOŁANA: pokaż [Wykonana] [Cofnij] */}
                                        {wizyta.status === 'odwolana' && (
                                          <>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleUpdateVisitStatus(wizyta, 'wykonana')}
                                              disabled={loading}
                                              className="text-green-600 hover:text-green-700"
                                              title="Pacjent jednak przyszedł - oznacz jako wykonana"
                                            >
                                              <CheckCircle className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleUpdateVisitStatus(wizyta, 'zaplanowana')}
                                              disabled={loading}
                                              className="text-blue-600 hover:text-blue-700"
                                              title="Cofnij do statusu zaplanowana"
                                            >
                                              <RotateCcw className="h-4 w-4" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                      <div className="flex space-x-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditWizyta(wizyta)}
                                          disabled={loading}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteWizyta(wizyta)}
                                          disabled={loading}
                                        >
                                          <Trash2 className="text-red-500 h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            Brak wizyt na wybrany dzień
                          </div>
                        )}
                      </ScrollArea>
                    </div>

                    <div className="flex-shrink-0 space-y-2">
                      <WizytyDodatkowePanel 
                        date={selectedDateStr}
                        variant="calendar"
                      />
                      <DailyNoteEditor 
                        date={selectedDateStr}
                        variant="calendar"
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="tydzien">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">
                        Tydzień {selectedDate ? 
                          `${format(weekDates[0], "d MMM", { locale: pl })} - ${format(weekDates[6], "d MMM yyyy", { locale: pl })}` : 
                          "Wybierz datę"
                        }
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToPreviousWeek}
                          disabled={loading}
                        >
                          ← Poprzedni
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToToday}
                          disabled={loading}
                        >
                          Dzisiaj
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToNextWeek}
                          disabled={loading}
                        >
                          Następny →
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-2">
                      {weekDates.map((date, index) => {
                        const dayWizyty = getWizytyForDate(date);
                        const isToday = format(date, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                        const isSelected = selectedDate && format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
                        const isVacation = isVacationDay(format(date, "yyyy-MM-dd"));
                        const isWorking = isWorkingDay(format(date, "yyyy-MM-dd"));
                        
                        return (
                          <div
                            key={index}
                            className={`border rounded-lg p-2 min-h-[120px] cursor-pointer ${
                              isVacation ? "bg-red-50 border-red-200" :
                              isToday ? "bg-blue-50 border-blue-200" : 
                              isSelected ? "bg-gray-50 border-gray-300" : 
                              isWorking ? "bg-white border-gray-200" :
                              "bg-gray-100 border-gray-200"
                            }`}
                            onClick={() => {
                              setSelectedDate(date);
                              setSelectedView("dzien");
                            }}
                          >
                            <div className="text-center mb-2">
                              <div className="text-sm font-medium text-gray-600">
                                {format(date, "EEE", { locale: pl })}
                              </div>
                              <div className={`text-lg font-semibold ${
                                isToday ? "text-blue-600" : 
                                isSelected ? "text-gray-900" : 
                                "text-gray-700"
                              }`}>
                                {format(date, "d")}
                              </div>
                            </div>
                            
                            <div className="space-y-1">
                              {dayWizyty.slice(0, 3).map((wizyta) => (
                                <div
                                  key={wizyta.id}
                                  className="text-xs p-1 bg-blue-100 text-blue-800 rounded cursor-pointer hover:bg-blue-200 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWizytaClick(wizyta);
                                  }}
                                  title={`${wizyta.godzina.substring(0, 5)} - ${wizyta.pacjenci.imie} ${wizyta.pacjenci.nazwisko}`}
                                >
                                  <div className="font-medium">
                                    {wizyta.godzina.substring(0, 5)}
                                  </div>
                                  <div className="truncate">
                                    {wizyta.pacjenci.imie} {wizyta.pacjenci.nazwisko}
                                  </div>
                                </div>
                              ))}
                              {dayWizyty.length > 3 && (
                                <div className="text-xs text-gray-500 text-center">
                                  +{dayWizyty.length - 3} więcej
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isMonthPreviewOpen} onOpenChange={setIsMonthPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle>
                {`Podgląd miesiąca - ${polskieMiesiace[monthPreviewDate.getMonth()]} ${monthPreviewDate.getFullYear()}`}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setMonthPreviewDate((prev) => {
                      const newDate = new Date(prev);
                      newDate.setMonth(newDate.getMonth() - 1);
                      return newDate;
                    })
                  }
                >
                  ← Poprzedni
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMonthPreviewDate(new Date())}
                >
                  Dzisiaj
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setMonthPreviewDate((prev) => {
                      const newDate = new Date(prev);
                      newDate.setMonth(newDate.getMonth() + 1);
                      return newDate;
                    })
                  }
                >
                  Następny →
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <ScrollArea className="h-[75vh] w-full">
              <div className="min-w-max">
                <table className="border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky top-0 left-0 z-20 bg-white border p-2 text-xs font-medium text-gray-600 min-w-[72px]">
                        Godzina
                      </th>
                      {monthPreviewDates.map((date, index) => {
                        const middleDate =
                          monthPreviewDates.length > 0
                            ? monthPreviewDates[Math.floor(monthPreviewDates.length / 2)]
                            : new Date();
                        const isCurrentMonth =
                          date.getMonth() === middleDate.getMonth() &&
                          date.getFullYear() === middleDate.getFullYear();

                        return (
                          <th
                            key={`${format(date, "yyyy-MM-dd")}-${index}`}
                            className={`sticky top-0 z-10 border p-2 text-center text-xs font-medium min-w-[44px] ${
                              isCurrentMonth
                                ? "bg-gray-50 text-gray-700"
                                : "bg-gray-100 text-gray-400"
                            }`}
                            title={format(date, "EEEE, d MMMM yyyy", {
                              locale: pl,
                            })}
                          >
                            <div>{format(date, "EEE", { locale: pl })}</div>
                            <div className="mt-1">{format(date, "d")}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {monthPreviewSlots.map((slot) => (
                      <tr key={slot}>
                        <td className="sticky left-0 z-10 bg-white border px-2 py-1 text-xs text-gray-600 font-medium">
                          {slot}
                        </td>
                        {monthPreviewDates.map((date, index) => {
                          const slotInfo = getMonthPreviewSlotState(date, slot);
                          const middleDate =
                            monthPreviewDates.length > 0
                              ? monthPreviewDates[Math.floor(monthPreviewDates.length / 2)]
                              : new Date();
                          const isCurrentMonth =
                            date.getMonth() === middleDate.getMonth() &&
                            date.getFullYear() === middleDate.getFullYear();
                          const formattedDate = format(date, "dd.MM.yyyy");
                          const vacationForDay = urlopy.find((u) => {
                            const d = new Date(formattedDate.split(".").reverse().join("-") + "T00:00:00");
                            return d >= new Date(u.data_od + "T00:00:00") && d <= new Date(u.data_do + "T00:00:00");
                          });
                          const cellTitle =
                            slotInfo.state === "vacation"
                              ? `Urlop${vacationForDay?.opis ? ` — ${vacationForDay.opis}` : ""}`
                              : slotInfo.state === "free"
                                ? `Dodaj wizytę — ${formattedDate} ${slot}`
                                : slotInfo.visit
                                  ? `Przejdź do wizyty — ${slotInfo.visit.pacjenci.imie} ${slotInfo.visit.pacjenci.nazwisko} ${slot}`
                                  : undefined;

                          return (
                            <td
                              key={`${format(date, "yyyy-MM-dd")}-${slot}-${index}`}
                              onClick={() => handleMonthPreviewSlotClick(date, slot)}
                              title={cellTitle}
                              className={`border h-5 min-w-[44px] cursor-pointer hover:opacity-80 ${
                                slotInfo.state === "vacation"
                                  ? "bg-yellow-200"
                                  : slotInfo.state === "gumki"
                                    ? "bg-green-400"
                                    : slotInfo.state === "occupied"
                                      ? "bg-blue-400"
                                      : "bg-white"
                              } ${!isCurrentMonth ? "opacity-50" : ""}`}
                            />
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog dodawania/edycji wizyty */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedWizyta ? "Edytuj wizytę" : "Dodaj nową wizytę"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pacjent" className="text-left">
                Pacjent
              </Label>
              <div className="col-span-3 flex gap-2">
                <Input
                  id="pacjent"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowPatientError(false); // Clear error when typing
                  }}
                  placeholder="Wpisz imię, nazwisko lub numer telefonu"
                  className={`flex-1 ${showPatientError ? 'border-red-500 bg-red-50' : ''}`}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      searchPacjenci(searchQuery);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => searchPacjenci(searchQuery)}
                  disabled={searchQuery.trim().length < 2 || loading}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Komunikat błędu dla pacjenta */}
            {showPatientError && (
              <div className="grid grid-cols-4 items-center gap-4">
                <div></div>
                <div className="col-span-3">
                  <div className="text-red-500 text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Proszę wybrać pacjenta przed dodaniem wizyty
                  </div>
                </div>
              </div>
            )}

            {/* Wskaźnik wybranego pacjenta */}
            {selectedPacjent && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Wybrany pacjent:</Label>
                <div className="col-span-3 flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    <span className="font-medium">
                      {selectedPacjent.imie} {selectedPacjent.nazwisko}
                    </span>
                    {selectedPacjent.telefon && (
                      <span className="text-sm text-muted-foreground ml-2">
                        ({selectedPacjent.telefon})
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedPacjent(null);
                      setSearchQuery("");
                      setShowPatientError(false); // Clear error when patient is deselected
                      setNowaWizyta({ ...nowaWizyta, pacjent_id: undefined });
                    }}
                    className="text-red-600 hover:text-red-800"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="data" className="text-left">
                Data
              </Label>
              <div className="col-span-3 flex">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {nowaWizyta.data ? format(new Date(nowaWizyta.data + "T00:00:00"), "dd.MM.yyyy") : "Wybierz datę"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-2 border-blue-300 shadow-xl bg-blue-50" align="start">
                    <Calendar
                      mode="single"
                      selected={nowaWizyta.data ? new Date(nowaWizyta.data + "T00:00:00") : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = format(date, "yyyy-MM-dd");
                          // Get first available hour from work schedule for the new date
                          const workingHours = generateWorkingHours(newDate);
                          const firstAvailableHour = workingHours.length > 0 ? workingHours[0] : "08:00:00";
                          
                          setNowaWizyta({ 
                            ...nowaWizyta, 
                            data: newDate,
                            godzina: firstAvailableHour
                          });
                        }
                      }}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="scale-100 origin-top-left border-2 border-blue-200 shadow-lg"
                      locale={pl}
                      weekStartsOn={1}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dlugosc" className="text-left flex items-center gap-2">
                <span>⏰</span>
                <span>Długość wizyty</span>
              </Label>
              <Select
                value={visitDuration}
                onValueChange={(value: '15min' | '30min' | 'custom') => {
                  setVisitDuration(value);
                  
                  // Dla custom wizyt, ustaw customStartTime na aktualną godzinę
                  if (value === 'custom' && nowaWizyta.godzina) {
                    setCustomStartTime(nowaWizyta.godzina.substring(0, 5));
                  }
                  
                  // Reset godzina when duration changes to force re-selection
                  setNowaWizyta({ ...nowaWizyta, godzina: "" });
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Wybierz długość wizyty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15min">15 minut</SelectItem>
                  <SelectItem value="30min">30 minut</SelectItem>
                  <SelectItem value="custom">Custom (od - do)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="godzina" className="text-left flex items-center gap-2">
                <span>🕒</span>
                <span>Godzina</span>
              </Label>
              <Select
                value={nowaWizyta.godzina}
                onValueChange={(value) => {
                  // Dla custom wizyt, nie przekazuj customStartTime żeby funkcja użyła wybranej godziny
                  const times = updateVisitTimes(value, visitDuration, visitDuration === 'custom' ? undefined : customStartTime, customEndTime, customDurationMinutes);
                  
                  // Dla custom wizyt, zsynchronizuj customStartTime i customEndTime z wybraną godziną
                  if (visitDuration === 'custom' && times.customStartTime) {
                    setCustomStartTime(times.customStartTime);
                    // Aktualizuj customEndTime na podstawie godzina_do
                    if (times.godzina_do) {
                      setCustomEndTime(times.godzina_do.substring(0, 5));
                    }
                  }
                  
                  setNowaWizyta({ ...nowaWizyta, ...times });
                  
                  // Check for conflicts and show warnings
                  if (nowaWizyta.data) {
                    // Najpierw sprawdź czy to dzień wolny od pracy
                    if (isVacationDay(nowaWizyta.data)) {
                      console.log('🔍 DEBUG - Ustawiam AlertDialog dla dnia urlopowego');
                      setTimeSlotWarningMessage('⚠️ Wybrany dzień jest dniem wolnym (urlop)');
                      setTimeSlotWarningDialog(true);
                    } else if (!isWorkingDay(nowaWizyta.data)) {
                      setTimeSlotWarningMessage('⚠️ Wybrany dzień nie jest dniem roboczym');
                      setTimeSlotWarningDialog(true);
                    } else if (!isWithinWorkingHours(nowaWizyta.data, value)) {
                      const dayName = getDayName(new Date(nowaWizyta.data + "T00:00:00"));
                      const daySchedule = planPracy[dayName];
                      if (daySchedule) {
                        setTimeSlotWarningMessage(`⚠️ Godzina poza planem pracy (${daySchedule.godziny.od} - ${daySchedule.godziny.do})`);
                        setTimeSlotWarningDialog(true);
                      } else {
                        setTimeSlotWarningMessage('⚠️ Godzina poza planem pracy');
                        setTimeSlotWarningDialog(true);
                      }
                    } else {
                      // Sprawdź konflikty z innymi wizytami
                      const isAvailable = isTimeSlotAvailable(
                        nowaWizyta.data,
                        value,
                        selectedWizyta?.id,
                        visitDuration,
                        customStartTime,
                        customEndTime,
                        customDurationMinutes,
                      );
                      
                      if (!isAvailable) {
                        // Find conflicting visits (exclude cancelled visits)
                        const conflictingVisits = wizyty.filter(wizyta => wizyta.status !== 'odwolana').filter(wizyta => {
                          if (!isSameDate(wizyta.data, nowaWizyta.data) || wizyta.id === selectedWizyta?.id) {
                            return false;
                          }
                          
                          const existingStart = wizyta.godzina;
                          const existingEnd = wizyta.godzina_do || addMinutesToTime(wizyta.godzina, 30);
                          const newEnd = times.godzina_do;
                          
                          return (value < existingEnd && newEnd > existingStart);
                        });
                        
                        if (conflictingVisits.length > 0) {
                          const conflict = conflictingVisits[0];
                          const conflictStart = conflict.godzina_od || conflict.godzina;
                          const conflictEnd = conflict.godzina_do || addMinutesToTime(conflict.godzina, 30);
                          setTimeSlotWarningMessage(`⚠️ Konflikt z wizytą ${conflictStart.substring(0, 5)}-${conflictEnd.substring(0, 5)} (${conflict.pacjenci?.imie} ${conflict.pacjenci?.nazwisko})`);
                          setTimeSlotWarningDialog(true);
                        } else {
                          setTimeSlotWarningMessage('⚠️ Ten termin nie jest dostępny');
                          setTimeSlotWarningDialog(true);
                        }
                      } else {
                        setTimeSlotWarning('');
                      }
                    }
                  }
                }}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Wybierz godzinę" />
                </SelectTrigger>
                <SelectContent>
                  {nowaWizyta.data ? (() => {
                    const allSlots = generateAllTimeSlots(
                      nowaWizyta.data, 
                      visitDuration, 
                      visitDuration === 'custom' ? customDurationMinutes : undefined
                    );
                    console.log('Generated slots for', nowaWizyta.data, 'duration', visitDuration, 'customMinutes', customDurationMinutes, ':', allSlots);
                    
                    // Fallback to default hours if no slots generated
                    if (allSlots.length === 0) {
                      return godzinyPrzyjec.map((godzina) => (
                        <SelectItem key={godzina} value={godzina}>
                          {godzina.substring(0, 5)}
                        </SelectItem>
                      ));
                    }
                    
                    return allSlots.map((slot) => {
                      const todayStr = format(new Date(), "yyyy-MM-dd");
                      const currentTime = format(new Date(), "HH:mm:ss");
                      const isPast = isSameDate(nowaWizyta.data, todayStr) && slot.time <= currentTime;
                      const isVacation = isVacationDay(nowaWizyta.data);
                      const isWorking = isWorkingDay(nowaWizyta.data);
                      
                      let statusText = '';
                      let statusColor = '';
                      let statusIcon = '';
                      
                      if (isPast) {
                        statusText = ' (przeszła)';
                        statusColor = 'text-gray-400';
                        statusIcon = '❌';
                      } else if (isVacation) {
                        statusText = ' (urlop)';
                        statusColor = 'text-orange-500';
                        statusIcon = '🚫';
                      } else if (!isWorking) {
                        statusText = ' (nie pracujemy)';
                        statusColor = 'text-gray-500';
                        statusIcon = '🚫';
                      } else if (!slot.available) {
                        statusText = ` (${slot.reason})`;
                        statusColor = 'text-red-500';
                        statusIcon = '❌';
                      } else {
                        statusText = ' (dostępne)';
                        statusColor = 'text-green-600';
                        statusIcon = '✅';
                      }
                      
                      return (
                        <SelectItem
                          key={slot.time}
                          value={slot.time}
                          disabled={!slot.available || isPast || isVacation || !isWorking}
                          className={statusColor}
                        >
                          <span className="flex items-center gap-2">
                            <span>{statusIcon}</span>
                            <span>{slot.time.substring(0, 5)}</span>
                            <span className="text-sm">{statusText}</span>
                          </span>
                        </SelectItem>
                      );
                    });
                  })() : godzinyPrzyjec.map((godzina) => (
                    <SelectItem key={godzina} value={godzina}>
                      {godzina.substring(0, 5)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {timeSlotWarning && (
              <div className="col-span-4">
                <div className={`border rounded-md p-3 ${
                  timeSlotWarning.includes('nie mieści się') 
                    ? 'bg-orange-50 border-orange-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <p className={`text-sm ${
                    timeSlotWarning.includes('nie mieści się') 
                      ? 'text-orange-700' 
                      : 'text-red-700'
                  }`}>
                    {timeSlotWarning}
                  </p>
                </div>
              </div>
            )}

            {visitDuration === 'custom' && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="customDuration" className="text-left flex items-center gap-2">
                    <span>⏱️</span>
                    <span>Długość wizyty</span>
                  </Label>
                  <Input
                    id="customDuration"
                    type="number"
                    min="15"
                    max="480"
                    step="15"
                    value={customDurationMinutes}
                    onChange={(e) => {
                      const minutes = parseInt(e.target.value) || 60;
                      setCustomDurationMinutes(minutes);
                      if (nowaWizyta.godzina_od) {
                        const times = updateVisitTimes(nowaWizyta.godzina_od, 'custom', undefined, undefined, minutes);
                        setNowaWizyta({ ...nowaWizyta, ...times });
                        
                        // Update custom end time display
                        const newEndTime = addMinutesToTime(nowaWizyta.godzina_od, minutes);
                        setCustomEndTime(newEndTime.substring(0, 5));
                        
                        // Check if visit fits within working hours
                        if (nowaWizyta.data) {
                          const dayName = getDayName(new Date(nowaWizyta.data + "T00:00:00"));
                          const daySchedule = planPracy[dayName];
                          if (daySchedule) {
                            const [endHour, endMin] = newEndTime.split(':').map(Number);
                            const [workEndHour, workEndMin] = daySchedule.godziny.do.split(':').map(Number);
                            if (endHour > workEndHour || (endHour === workEndHour && endMin > workEndMin)) {
                              setTimeSlotWarningMessage(`⚠️ Wizyta ${minutes} min nie mieści się w planie pracy (do ${daySchedule.godziny.do})`);
                              setTimeSlotWarningDialog(true);
                            } else {
                              setTimeSlotWarning('');
                            }
                          }
                        }
                      }
                    }}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="customStart" className="text-left flex items-center gap-2">
                    <span>🕐</span>
                    <span>Od</span>
                  </Label>
                  <Input
                    id="customStart"
                    type="time"
                    value={customStartTime}
                    onChange={(e) => {
                      setCustomStartTime(e.target.value);
                      const times = updateVisitTimes(e.target.value + ':00', 'custom', undefined, undefined, customDurationMinutes);
                      
                      // Zsynchronizuj z główną godziną
                      setNowaWizyta({ 
                        ...nowaWizyta, 
                        ...times,
                        godzina: e.target.value + ':00'
                      });
                      
                      // Update custom end time display
                      const newEndTime = addMinutesToTime(e.target.value + ':00', customDurationMinutes);
                      setCustomEndTime(newEndTime.substring(0, 5));
                      
                      // Check if visit fits within working hours
                      if (nowaWizyta.data) {
                        const dayName = getDayName(new Date(nowaWizyta.data + "T00:00:00"));
                        const daySchedule = planPracy[dayName];
                        if (daySchedule) {
                          const [endHour, endMin] = newEndTime.split(':').map(Number);
                          const [workEndHour, workEndMin] = daySchedule.godziny.do.split(':').map(Number);
                          if (endHour > workEndHour || (endHour === workEndHour && endMin > workEndMin)) {
                            setTimeSlotWarningMessage(`⚠️ Wizyta ${customDurationMinutes} min nie mieści się w planie pracy (do ${daySchedule.godziny.do})`);
                            setTimeSlotWarningDialog(true);
                          } else {
                            setTimeSlotWarning('');
                          }
                        }
                      }
                    }}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="customEnd" className="text-left flex items-center gap-2">
                    <span>🕕</span>
                    <span>Do</span>
                  </Label>
                  <Input
                    id="customEnd"
                    type="time"
                    value={customEndTime}
                    disabled
                    className="col-span-3 bg-gray-100"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rodzaj" className="text-left">
                Rodzaj wizyty
              </Label>
              <Select
                value={nowaWizyta.rodzaj}
                onValueChange={(value) =>
                  setNowaWizyta({ ...nowaWizyta, rodzaj: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Wybierz rodzaj wizyty" />
                </SelectTrigger>
                <SelectContent>
                  {rodzajeWizyt.map((rodzaj) => (
                    <SelectItem key={rodzaj} value={rodzaj}>
                      {rodzaj}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notatki" className="text-left">
                Notatki
              </Label>
              <Textarea
                id="notatki"
                value={nowaWizyta.notatki || ""}
                onChange={(e) =>
                  setNowaWizyta({ ...nowaWizyta, notatki: e.target.value })
                }
                placeholder="Opis zabiegu, uwagi, itp."
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button onClick={handleSaveWizyta} disabled={loading}>
              {loading
                ? "Zapisywanie..."
                : selectedWizyta
                  ? "Zapisz zmiany"
                  : "Dodaj wizytę"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog potwierdzenia usunięcia */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Potwierdź usunięcie</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>
              Czy na pewno chcesz usunąć wizytę dla pacjenta{" "}
              {selectedWizyta?.pacjenci.imie}{" "}
              {selectedWizyta?.pacjenci.nazwisko} w dniu{" "}
              {selectedWizyta?.data
                ? format(
                    new Date(selectedWizyta.data + "T00:00:00"),
                    "d MMMM yyyy",
                    { locale: pl },
                  )
                : ""}{" "}
              o godzinie {selectedWizyta?.godzina?.substring(0, 5)}?
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={loading}
            >
              {loading ? "Usuwanie..." : "Usuń"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Popup z wynikami wyszukiwania pacjentów */}
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Wyniki wyszukiwania</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-2">
            {searchResults.length > 0 ? (
              // Pokaż znalezionych pacjentów
              <div className="space-y-2">
                {searchResults.map((pacjent) => (
                  <div
                    key={pacjent.id}
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedPacjent(pacjent);
                      setSearchQuery(`${pacjent.imie} ${pacjent.nazwisko}`);
                      setIsSearchOpen(false);
                      setShowPatientError(false); // Clear error when patient is selected
                      setNowaWizyta({
                        ...nowaWizyta,
                        pacjent_id: pacjent.id,
                      });
                    }}
                  >
                    <div>
                      <p className="font-medium">{pacjent.imie} {pacjent.nazwisko}</p>
                      <p className="text-sm text-muted-foreground">
                        Tel: {pacjent.telefon}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      Wybierz
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              // Nie znaleziono - pokaż komunikat z przekierowaniem
              <div className="text-center py-6">
                <div className="mb-4">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground mb-2">
                    Nie znaleziono pacjenta: "{searchQuery}"
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Aby dodać nowego pacjenta:
                  </p>
                  <ol className="text-sm text-muted-foreground mt-2 text-left max-w-md mx-auto">
                    <li>1. Przejdź do zakładki "Pacjenci"</li>
                    <li>2. Kliknij "Dodaj nowego pacjenta"</li>
                    <li>3. Wypełnij formularz i zapisz</li>
                    <li>4. Wróć tutaj i wyszukaj ponownie</li>
                  </ol>
                </div>
                
                <div className="space-y-2">
                  {onNavigateToPatients && (
                    <Button
                      onClick={() => {
                        setIsSearchOpen(false);
                        onNavigateToPatients();
                      }}
                      className="w-full"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Przejdź do panelu Pacjenci
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSearchOpen(false)}>
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog planu pracy */}
      <Dialog
        open={isWorkScheduleDialogOpen}
        onOpenChange={setIsWorkScheduleDialogOpen}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Plan pracy kliniki</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <div className="space-y-6">
              {Object.entries(tempPlanPracy)
                .sort(([a], [b]) => {
                  const order = ['poniedzialek', 'wtorek', 'sroda', 'czwartek', 'piatek', 'sobota', 'niedziela'];
                  return order.indexOf(a) - order.indexOf(b);
                })
                .map(([dzien, config]) => {
                const dniTygodnia = {
                  poniedzialek: "Poniedziałek",
                  wtorek: "Wtorek",
                  sroda: "Środa",
                  czwartek: "Czwartek",
                  piatek: "Piątek",
                  sobota: "Sobota",
                  niedziela: "Niedziela",
                };

                return (
                  <div
                    key={dzien}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-24">
                        <Label className="text-sm font-medium">
                          {dniTygodnia[dzien as keyof typeof dniTygodnia]}
                        </Label>
                      </div>
                      <Switch
                        checked={config.aktywny}
                        onCheckedChange={(checked) => {
                          setTempPlanPracy({
                            ...tempPlanPracy,
                            [dzien]: {
                              ...config,
                              aktywny: checked,
                            },
                          });
                        }}
                      />
                      <span className="text-sm text-gray-500">
                        {config.aktywny ? "Dzień roboczy" : "Dzień wolny"}
                      </span>
                    </div>

                    {config.aktywny && (
                      <div className="flex items-center space-x-2">
                        <Label className="text-sm">Od:</Label>
                        <Input
                          type="time"
                          value={config.godziny.od}
                          onChange={(e) => {
                            setTempPlanPracy({
                              ...tempPlanPracy,
                              [dzien]: {
                                ...config,
                                godziny: {
                                  ...config.godziny,
                                  od: e.target.value,
                                },
                              },
                            });
                          }}
                          className="w-20"
                        />
                        <Label className="text-sm">Do:</Label>
                        <Input
                          type="time"
                          value={config.godziny.do}
                          onChange={(e) => {
                            setTempPlanPracy({
                              ...tempPlanPracy,
                              [dzien]: {
                                ...config,
                                godziny: {
                                  ...config.godziny,
                                  do: e.target.value,
                                },
                              },
                            });
                          }}
                          className="w-20"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTempPlanPracy(planPracy);
                setIsWorkScheduleDialogOpen(false);
              }}
            >
              Anuluj
            </Button>
            <Button
              onClick={handleSaveWorkSchedule}
              disabled={loading}
            >
              {loading ? "Zapisywanie..." : "Zapisz plan pracy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog zarządzania urlopami */}
      <Dialog open={isVacationDialogOpen} onOpenChange={setIsVacationDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {selectedUrlop ? "Edytuj urlop" : "Dodaj nowy urlop"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_od">Data początkowa</Label>
                  <Input
                    id="data_od"
                    type="date"
                    value={nowyUrlop.data_od || ""}
                    onChange={(e) =>
                      setNowyUrlop({ ...nowyUrlop, data_od: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_do">Data końcowa</Label>
                  <Input
                    id="data_do"
                    type="date"
                    value={nowyUrlop.data_do || ""}
                    onChange={(e) =>
                      setNowyUrlop({ ...nowyUrlop, data_do: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="opis">Opis urlopu (opcjonalnie)</Label>
                <Input
                  id="opis"
                  value={nowyUrlop.opis || ""}
                  onChange={(e) =>
                    setNowyUrlop({ ...nowyUrlop, opis: e.target.value })
                  }
                  placeholder="np. Wakacje, Święta, Szkolenie"
                />
              </div>
              
              {/* Lista istniejących urlopów */}
              <div className="space-y-2">
                <Label>Istniejące urlopy</Label>
                <ScrollArea className="h-[200px] border rounded-md p-2">
                  {urlopy.length > 0 ? (
                    <div className="space-y-2">
                      {urlopy.map((urlop) => (
                        <div
                          key={urlop.id}
                          className="flex items-center justify-between p-2 border rounded-md bg-gray-50"
                        >
                          <div>
                            <div className="font-medium">
                              {format(new Date(urlop.data_od), "dd.MM.yyyy", { locale: pl })} - 
                              {format(new Date(urlop.data_do), "dd.MM.yyyy", { locale: pl })}
                            </div>
                            {urlop.opis && (
                              <div className="text-sm text-gray-600">{urlop.opis}</div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditVacation(urlop)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteVacation(urlop)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      Brak urlopów
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsVacationDialogOpen(false)}
              disabled={loading}
            >
              Anuluj
            </Button>
            <Button onClick={handleSaveVacation} disabled={loading}>
              {loading
                ? "Zapisywanie..."
                : selectedUrlop
                  ? "Zapisz zmiany"
                  : "Dodaj urlop"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={timeSlotWarningDialog} onOpenChange={setTimeSlotWarningDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termin niedostępny</AlertDialogTitle>
            <AlertDialogDescription>
              {timeSlotWarningMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              console.log('🔍 DEBUG - AlertDialog zamknięty');
              setTimeSlotWarningDialog(false);
            }}>
              Rozumiem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog dla sukcesu */}
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Sukces
            </AlertDialogTitle>
            <AlertDialogDescription>
              {successMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSuccessDialog(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default KalendarzWizyt;