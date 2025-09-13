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
} from "lucide-react";
import {
  supabase,
  type Pacjent,
  type Wizyta,
  type WizytaInsert,
} from "@/lib/supabase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

interface WizytaWithPacjent extends Wizyta {
  pacjenci: Pacjent;
}

interface KalendarzWizytProps {
  onNavigateToPatients?: () => void;
}

interface GodzinyPracy {
  od: string;
  do: string;
}

interface PlanPracy {
  poniedzialek: { aktywny: boolean; godziny: GodzinyPracy };
  wtorek: { aktywny: boolean; godziny: GodzinyPracy };
  sroda: { aktywny: boolean; godziny: GodzinyPracy };
  czwartek: { aktywny: boolean; godziny: GodzinyPracy };
  piatek: { aktywny: boolean; godziny: GodzinyPracy };
  sobota: { aktywny: boolean; godziny: GodzinyPracy };
  niedziela: { aktywny: boolean; godziny: GodzinyPracy };
}

const KalendarzWizyt = ({ onNavigateToPatients }: KalendarzWizytProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [selectedView, setSelectedView] = useState("dzien");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isWorkScheduleDialogOpen, setIsWorkScheduleDialogOpen] =
    useState(false);
  const [selectedWizyta, setSelectedWizyta] =
    useState<WizytaWithPacjent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchingSlots, setSearchingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<
    Array<{ date: string; time: string; displayDate: string }>
  >([]);
  const [currentSearchDate, setCurrentSearchDate] = useState<Date>(new Date());

  // Plan pracy
  const [planPracy, setPlanPracy] = useState<PlanPracy>({
    poniedzialek: { aktywny: true, godziny: { od: "08:00", do: "17:00" } },
    wtorek: { aktywny: true, godziny: { od: "08:00", do: "17:00" } },
    sroda: { aktywny: true, godziny: { od: "08:00", do: "17:00" } },
    czwartek: { aktywny: true, godziny: { od: "08:00", do: "17:00" } },
    piatek: { aktywny: true, godziny: { od: "08:00", do: "17:00" } },
    sobota: { aktywny: false, godziny: { od: "08:00", do: "14:00" } },
    niedziela: { aktywny: false, godziny: { od: "08:00", do: "14:00" } },
  });
  const [tempPlanPracy, setTempPlanPracy] = useState<PlanPracy>(planPracy);

  const [wizyty, setWizyty] = useState<WizytaWithPacjent[]>([]);
  const [pacjenci, setPacjenci] = useState<Pacjent[]>([]);
  const [searchResults, setSearchResults] = useState<Pacjent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedPacjent, setSelectedPacjent] = useState<Pacjent | null>(null);
  const [isSelectingPatient, setIsSelectingPatient] = useState(false);

  const [nowaWizyta, setNowaWizyta] = useState<Partial<WizytaInsert>>({
    data: format(new Date(), "yyyy-MM-dd"),
    godzina: "08:00:00",
    rodzaj: "Przegląd",
    notatki: "",
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
    "Przegląd",
    "Konsultacja",
    "Wypełnienie",
    "Leczenie kanałowe",
    "Ekstrakcja",
    "Higienizacja",
    "Protetyka",
    "Ortodoncja",
    "Inne",
  ];

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

  // Fetch wizyty from database
  const fetchWizyty = async () => {
    try {
      const { data, error } = await supabase
        .from("wizyty")
        .select(
          `
          *,
          pacjenci (*)
        `,
        )
        .order("data")
        .order("godzina");

      if (error) throw error;
      setWizyty(data || []);
    } catch (err) {
      console.error("Error fetching wizyty:", err);
      setError("Błąd podczas pobierania wizyt");
    }
  };

  // Get day name in Polish
  const getDayName = (date: Date): keyof PlanPracy => {
    const days: (keyof PlanPracy)[] = [
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

  // Check if date is a working day
  const isWorkingDay = (date: string): boolean => {
    const dateObj = new Date(date + "T00:00:00");
    const dayName = getDayName(dateObj);
    return planPracy[dayName].aktywny;
  };

  // Check if time is within working hours
  const isWithinWorkingHours = (date: string, time: string): boolean => {
    if (!isWorkingDay(date)) return false;

    const dateObj = new Date(date + "T00:00:00");
    const dayName = getDayName(dateObj);
    const workingHours = planPracy[dayName].godziny;

    const timeOnly = time.substring(0, 5); // Get HH:MM format
    return timeOnly >= workingHours.od && timeOnly <= workingHours.do;
  };

  // Check if time slot is available
  const isTimeSlotAvailable = (
    data: string,
    godzina: string,
    excludeId?: string,
  ) => {
    // Check if it's within working hours
    if (!isWithinWorkingHours(data, godzina)) {
      return false;
    }

    // Check if slot is not already taken
    return !wizyty.some(
      (wizyta) =>
        wizyta.data === data &&
        wizyta.godzina === godzina &&
        wizyta.id !== excludeId,
    );
  };

  useEffect(() => {
    fetchPacjenci();
    fetchWizyty();
  }, []);

  const handleAddWizyta = () => {
    setSelectedWizyta(null);
    setSelectedPacjent(null);
    setSearchQuery("");
    setSearchResults([]);
    setNowaWizyta({
      data: selectedDate
        ? format(selectedDate, "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
      godzina: "08:00:00",
      rodzaj: "Przegląd",
      notatki: "",
    });
    setError(null);
    setIsDialogOpen(true);
  };

  const handleEditWizyta = (wizyta: WizytaWithPacjent) => {
    setSelectedWizyta(wizyta);
    setSelectedPacjent(wizyta.pacjenci);
    setSearchQuery(`${wizyta.pacjenci.imie} ${wizyta.pacjenci.nazwisko}`);
    setSearchResults([]);
    setNowaWizyta({
      pacjent_id: wizyta.pacjent_id,
      data: wizyta.data,
      godzina: wizyta.godzina,
      rodzaj: wizyta.rodzaj,
      notatki: wizyta.notatki,
    });
    setError(null);
    setIsDialogOpen(true);
  };

  const handleDeleteWizyta = (wizyta: WizytaWithPacjent) => {
    setSelectedWizyta(wizyta);
    setIsDeleteDialogOpen(true);
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

      await fetchWizyty();
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
    if (
      !nowaWizyta.pacjent_id ||
      !nowaWizyta.data ||
      !nowaWizyta.godzina ||
      !nowaWizyta.rodzaj
    ) {
      setError("Wszystkie pola są wymagane");
      return;
    }

    // Check if time slot is available
    // Check if time slot is available (includes working hours check)
    if (
      !isTimeSlotAvailable(
        nowaWizyta.data,
        nowaWizyta.godzina,
        selectedWizyta?.id,
      )
    ) {
      if (!isWorkingDay(nowaWizyta.data)) {
        setError("Wybrany dzień nie jest dniem roboczym.");
      } else if (!isWithinWorkingHours(nowaWizyta.data, nowaWizyta.godzina)) {
        setError("Wybrana godzina jest poza godzinami pracy kliniki.");
      } else {
        setError("Ten termin jest już zajęty. Wybierz inną godzinę.");
      }
      return;
    }

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
            rodzaj: nowaWizyta.rodzaj,
            notatki: nowaWizyta.notatki || "",
          })
          .eq("id", selectedWizyta.id);

        if (error) throw error;
      } else {
        // Insert new wizyta
        const { error } = await supabase.from("wizyty").insert({
          pacjent_id: nowaWizyta.pacjent_id,
          data: nowaWizyta.data,
          godzina: nowaWizyta.godzina,
          rodzaj: nowaWizyta.rodzaj,
          notatki: nowaWizyta.notatki || "",
        });

        if (error) throw error;
      }

      await fetchWizyty();
      setIsDialogOpen(false);
      // Wyczyść formularz po zapisaniu
      setNowaWizyta({
        data: selectedDate
          ? format(selectedDate, "yyyy-MM-dd")
          : format(new Date(), "yyyy-MM-dd"),
        godzina: "08:00:00",
        rodzaj: "Przegląd",
        notatki: "",
      });
      setSelectedWizyta(null);
      setSelectedPacjent(null);
      setSearchQuery("");
      setSearchResults([]);
    } catch (err: any) {
      console.error("Error saving wizyta:", err);
      if (err.code === "23505") {
        setError("Ten termin jest już zajęty. Wybierz inną godzinę.");
      } else {
        setError("Błąd podczas zapisywania wizyty");
      }
    } finally {
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

  const znajdzNajblizszeTerminy = async (
    startDate: Date = new Date(),
    limit: number = 10,
  ) => {
    setSearchingSlots(true);
    setError(null);

    try {
      const slots: Array<{ date: string; time: string; displayDate: string }> =
        [];
      let currentDate = new Date(startDate);
      let daysChecked = 0;
      const maxDaysToCheck = 60; // Sprawdź maksymalnie 60 dni w przód

      while (slots.length < limit && daysChecked < maxDaysToCheck) {
        // Sprawdź czy to dzień roboczy według planu pracy
        const dataStr = format(currentDate, "yyyy-MM-dd");
        if (isWorkingDay(dataStr)) {
          const zajeteGodziny = wizyty
            .filter((w) => w.data === dataStr)
            .map((w) => w.godzina);

          // Filtruj godziny według planu pracy i zajętości
          const wolneGodziny = godzinyPrzyjec.filter(
            (g) =>
              !zajeteGodziny.includes(g) && isWithinWorkingHours(dataStr, g),
          );

          // Dodaj wszystkie wolne godziny z tego dnia
          for (const godzina of wolneGodziny) {
            if (slots.length < limit) {
              slots.push({
                date: dataStr,
                time: godzina,
                displayDate: format(currentDate, "EEEE, d MMMM yyyy", {
                  locale: pl,
                }),
              });
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
        daysChecked++;
      }

      setAvailableSlots(slots);
      setCurrentSearchDate(new Date(currentDate));
    } catch (err) {
      console.error("Error finding available slots:", err);
      setError("Błąd podczas wyszukiwania wolnych terminów");
    } finally {
      setSearchingSlots(false);
    }
  };

  const znajdzKolejneTerminy = () => {
    znajdzNajblizszeTerminy(currentSearchDate, 10);
  };

  const selectTimeSlot = (date: string, time: string) => {
    setSelectedPacjent(null);
    setSearchQuery("");
    setSearchResults([]);
    setNowaWizyta({
      ...nowaWizyta,
      data: date,
      godzina: time,
    });
    setSelectedDate(new Date(date + "T00:00:00"));
    setIsDialogOpen(true);
  };

  // Inicjalne wyszukanie terminów
  useEffect(() => {
    if (wizyty.length > 0) {
      znajdzNajblizszeTerminy();
    }
  }, [wizyty]);

  // Search for patients - ONLY when user explicitly requests it via button
  // useEffect removed - no automatic searching

  return (
    <div className="bg-white p-6 rounded-lg shadow-md w-full">
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
                  onClick={() => znajdzNajblizszeTerminy()}
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
                  <h3 className="text-lg font-medium mb-4">
                    Najbliższe wolne terminy
                  </h3>
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
              <div className="flex justify-between items-center">
                <CardTitle>
                  {selectedDate
                    ? format(selectedDate, "EEEE, d MMMM yyyy", { locale: pl })
                    : "Wybierz datę"}
                </CardTitle>
                <Tabs
                  value={selectedView}
                  onValueChange={setSelectedView}
                  className="w-[400px]"
                >
                  <TabsList>
                    <TabsTrigger value="dzien">Dzień</TabsTrigger>
                    <TabsTrigger value="tydzien">Tydzień</TabsTrigger>
                    <TabsTrigger value="miesiac">Miesiąc</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs
                value={selectedView}
                onValueChange={setSelectedView}
                className="w-full"
              >
                <TabsContent value="dzien" className="mt-0">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Wizyty na dziś</h3>
                    <ScrollArea className="h-[500px] pr-4">
                      {wizytyNaDzien.length > 0 ? (
                        <div className="space-y-4">
                          {wizytyNaDzien.map((wizyta) => (
                            <Card
                              key={wizyta.id}
                              className="border-l-4 border-l-blue-500"
                            >
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="flex items-center mb-2">
                                      <Clock className="h-4 w-4 mr-2 text-gray-500" />
                                      <span className="font-medium">
                                        {wizyta.godzina.substring(0, 5)}
                                      </span>
                                    </div>
                                    <h4 className="text-lg font-semibold">
                                      {wizyta.pacjenci.imie}{" "}
                                      {wizyta.pacjenci.nazwisko}
                                    </h4>
                                    <p className="text-sm text-gray-600">
                                      {wizyta.rodzaj}
                                    </p>
                                    {wizyta.notatki && (
                                      <p className="text-sm mt-2 text-gray-500">
                                        {wizyta.notatki}
                                      </p>
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
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 text-gray-500">
                          Brak wizyt na wybrany dzień
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </TabsContent>

                <TabsContent value="tydzien">
                  <div className="text-center py-10 text-gray-500">
                    Widok tygodniowy będzie dostępny wkrótce
                  </div>
                </TabsContent>

                <TabsContent value="miesiac">
                  <div className="text-center py-10 text-gray-500">
                    Widok miesięczny będzie dostępny wkrótce
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

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
              <Label htmlFor="pacjent" className="text-right">
                Pacjent
              </Label>
              <div className="col-span-3 flex gap-2">
                <Input
                  id="pacjent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Wpisz imię, nazwisko lub numer telefonu"
                  className="flex-1"
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
              <Label htmlFor="data" className="text-right">
                Data
              </Label>
              <div className="col-span-3 flex">
                <Input
                  id="data"
                  type="date"
                  value={nowaWizyta.data || ""}
                  onChange={(e) => {
                    setNowaWizyta({ ...nowaWizyta, data: e.target.value });
                  }}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="godzina" className="text-right">
                Godzina
              </Label>
              <Select
                value={nowaWizyta.godzina}
                onValueChange={(value) =>
                  setNowaWizyta({ ...nowaWizyta, godzina: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Wybierz godzinę" />
                </SelectTrigger>
                <SelectContent>
                  {godzinyPrzyjec.map((godzina) => {
                    const isAvailable = nowaWizyta.data
                      ? isTimeSlotAvailable(
                          nowaWizyta.data,
                          godzina,
                          selectedWizyta?.id,
                        )
                      : true;

                    const isInWorkingHours = nowaWizyta.data
                      ? isWithinWorkingHours(nowaWizyta.data, godzina)
                      : true;

                    const isWorkDay = nowaWizyta.data
                      ? isWorkingDay(nowaWizyta.data)
                      : true;

                    let statusText = "";
                    if (!isWorkDay) {
                      statusText = "(dzień wolny)";
                    } else if (!isInWorkingHours) {
                      statusText = "(poza godzinami pracy)";
                    } else if (!isAvailable) {
                      statusText = "(zajęte)";
                    }

                    return (
                      <SelectItem
                        key={godzina}
                        value={godzina}
                        disabled={!isAvailable}
                      >
                        {godzina.substring(0, 5)} {statusText}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rodzaj" className="text-right">
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
              <Label htmlFor="notatki" className="text-right">
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
            <div className="space-y-6">
              {Object.entries(tempPlanPracy).map(([dzien, config]) => {
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
              onClick={() => {
                setPlanPracy(tempPlanPracy);
                setIsWorkScheduleDialogOpen(false);
              }}
            >
              Zapisz plan pracy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KalendarzWizyt;