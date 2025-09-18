import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { validatePESEL, extractDateFromPESEL, formatPESEL } from "@/lib/utils";
import { type VisitStatus } from "@/lib/supabase";

interface Wizyta {
  id: string;
  data: Date;
  rodzaj: string;
  notatki: string;
  status?: VisitStatus;
}


interface Pacjent {
  id: string;
  imie: string;
  nazwisko: string;
  telefon: string;
  email: string;
  adres: string;
  pesel: string | null;
  brakPesel: boolean;
  wizyty: Wizyta[];
  notatkiOgolne?: string;
}

const KartaPacjenta = ({ pacjentId }: { pacjentId: string }) => {
  const [pacjent, setPacjent] = useState<Pacjent | null>(null);
  const [loading, setLoading] = useState(true);

  // Pobierz dane pacjenta z Supabase
  useEffect(() => {
    const fetchPacjent = async () => {
      try {
        const { data, error } = await supabase
          .from('pacjenci')
          .select('*')
          .eq('id', pacjentId)
          .single();

        if (error) throw error;

        if (data) {
          // Pobierz wizyty dla tego pacjenta
          const { data: wizytyData, error: wizytyError } = await supabase
            .from('wizyty')
            .select('*')
            .eq('pacjent_id', pacjentId)
            .order('data', { ascending: false });

          if (wizytyError) {
            console.error('Error fetching visits:', wizytyError);
          }

          const wizyty = wizytyData?.map(wizyta => ({
            id: wizyta.id,
            data: new Date(wizyta.data + 'T' + wizyta.godzina),
            rodzaj: wizyta.rodzaj,
            notatki: wizyta.notatki || '',
            status: wizyta.status || 'zaplanowana'
          })) || [];

          setPacjent({
            id: data.id,
            imie: data.imie,
            nazwisko: data.nazwisko,
            telefon: data.telefon,
            email: data.email || '',
            adres: data.adres || '',
            pesel: data.pesel || null,
            brakPesel: data.brak_pesel || false,
            notatkiOgolne: data.notatki || '',
            wizyty: wizyty,
          });
        }
      } catch (error) {
        console.error('Error fetching patient:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPacjent();
  }, [pacjentId]);

  // Hooki muszą być wywoływane przed każdym return
  const [edytujDane, setEdytujDane] = useState(false);
  const [nowaWizyta, setNowaWizyta] = useState(false);
  const [edytowanaWizyta, setEdytowanaWizyta] = useState<Wizyta | null>(null);

  // Get visit background color based on status
  const getVisitBackgroundColor = (status?: VisitStatus): string => {
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

  // Formularz danych pacjenta - użyj domyślnych wartości
  const [formDane, setFormDane] = useState({
    imie: pacjent?.imie || "",
    nazwisko: pacjent?.nazwisko || "",
    telefon: pacjent?.telefon || "",
    email: pacjent?.email || "",
    adres: pacjent?.adres || "",
    pesel: pacjent?.pesel || "",
    brakPesel: pacjent?.brakPesel || false,
    notatkiOgolne: pacjent?.notatkiOgolne || "",
  });

  // Formularz wizyty
  const [formWizyta, setFormWizyta] = useState({
    data: "",
    czas: "",
    rodzaj: "",
    notatki: "",
  });


  // Aktualizuj formularz gdy pacjent się zmieni
  useEffect(() => {
    if (pacjent) {
      setFormDane({
        imie: pacjent.imie,
        nazwisko: pacjent.nazwisko,
        telefon: pacjent.telefon,
        email: pacjent.email,
        adres: pacjent.adres,
        pesel: pacjent.pesel || "",
        brakPesel: pacjent.brakPesel || false,
        notatkiOgolne: pacjent.notatkiOgolne || "",
      });
    }
  }, [pacjent]);

  if (loading) {
    return <div>Ładowanie danych pacjenta...</div>;
  }

  if (!pacjent) {
    return <div>Nie znaleziono pacjenta</div>;
  }

  // Obsługa formularza danych pacjenta
  const handleDaneChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormDane((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormDane((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleDaneSubmit = () => {
    const updatedPacjent = {
      ...pacjent,
      imie: formDane.imie,
      nazwisko: formDane.nazwisko,
      telefon: formDane.telefon,
      email: formDane.email,
      adres: formDane.adres,
      pesel: formDane.brakPesel ? null : formDane.pesel,
      brakPesel: formDane.brakPesel,
      notatkiOgolne: formDane.notatkiOgolne,
    };
    setPacjent(updatedPacjent);
    setEdytujDane(false);
  };

  // Obsługa formularza wizyty
  const handleWizytaChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormWizyta((prev) => ({ ...prev, [name]: value }));
  };

  const handleWizytaSubmit = async () => {
    const dataCzas = new Date(`${formWizyta.data}T${formWizyta.czas}`);

    try {
      if (edytowanaWizyta) {
        // Edycja istniejącej wizyty w bazie danych
        const { error } = await supabase
          .from('wizyty')
          .update({
            data: formWizyta.data,
            godzina: formWizyta.czas,
            rodzaj: formWizyta.rodzaj,
            notatki: formWizyta.notatki
          })
          .eq('id', edytowanaWizyta.id);

        if (error) throw error;

        // Aktualizuj lokalny stan
        const updatedWizyty = pacjent.wizyty.map((w) =>
          w.id === edytowanaWizyta.id
            ? {
                ...w,
                data: dataCzas,
                rodzaj: formWizyta.rodzaj,
                notatki: formWizyta.notatki,
              }
            : w,
        );
        setPacjent({ ...pacjent, wizyty: updatedWizyty });
        setEdytowanaWizyta(null);
      } else {
        // Dodanie nowej wizyty do bazy danych
        const { data: newWizyta, error } = await supabase
          .from('wizyty')
          .insert({
            pacjent_id: pacjentId,
            data: formWizyta.data,
            godzina: formWizyta.czas,
            rodzaj: formWizyta.rodzaj,
            notatki: formWizyta.notatki
          })
          .select()
          .single();

        if (error) throw error;

        // Dodaj do lokalnego stanu
        const nowaWizyta: Wizyta = {
          id: newWizyta.id,
          data: dataCzas,
          rodzaj: formWizyta.rodzaj,
          notatki: formWizyta.notatki,
        };
        setPacjent({ ...pacjent, wizyty: [...pacjent.wizyty, nowaWizyta] });
      }

      // Zamknij dialog i wyczyść formularz
      setNowaWizyta(false);
      setFormWizyta({ data: "", czas: "", rodzaj: "", notatki: "" });
    } catch (error) {
      console.error('Error saving visit:', error);
    }
  };


  // Usuwanie wizyty
  const handleUsunWizyte = async (id: string) => {
    try {
      const { error } = await supabase
        .from('wizyty')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const updatedWizyty = pacjent.wizyty.filter((w) => w.id !== id);
      setPacjent({ ...pacjent, wizyty: updatedWizyty });
    } catch (error) {
      console.error('Error deleting visit:', error);
    }
  };


  // Edycja wizyty
  const handleEdytujWizyte = (wizyta: Wizyta) => {
    setEdytowanaWizyta(wizyta);
    setFormWizyta({
      data: format(wizyta.data, "yyyy-MM-dd"),
      czas: format(wizyta.data, "HH:mm"),
      rodzaj: wizyta.rodzaj,
      notatki: wizyta.notatki,
    });
    setNowaWizyta(true);
  };

  // Otwórz dialog dodawania nowej wizyty
  const handleNowaWizyta = () => {
    console.log("handleNowaWizyta - przed czyszczeniem:", formWizyta);
    setEdytowanaWizyta(null);
    // Wyczyść formularz wizyty
    setFormWizyta({ data: "", czas: "", rodzaj: "", notatki: "" });
    console.log("handleNowaWizyta - po czyszczeniu");
    setNowaWizyta(true);
  };

  // Zamknij dialog wizyty i wyczyść formularz
  const handleCloseWizyta = (open: boolean) => {
    console.log("handleCloseWizyta - open:", open, "formWizyta:", formWizyta);
    setNowaWizyta(open);
    if (!open) {
      // Wyczyść formularz gdy dialog jest zamykany
      setFormWizyta({ data: "", czas: "", rodzaj: "", notatki: "" });
      setEdytowanaWizyta(null);
      console.log("handleCloseWizyta - formularz wyczyszczony");
    }
  };


  return (
    <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Karta Pacjenta: {pacjent.imie} {pacjent.nazwisko}
        </h1>
        <Button onClick={() => setEdytujDane(true)} variant="outline">
          <PencilIcon className="h-4 w-4 mr-2" /> Edytuj dane
        </Button>
      </div>

      <Tabs defaultValue="dane" className="w-full">
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger value="dane">Dane osobowe</TabsTrigger>
          <TabsTrigger value="wizyty">Historia wizyt</TabsTrigger>
        </TabsList>

        {/* Zakładka z danymi osobowymi */}
        <TabsContent value="dane">
          <Card>
            <CardHeader>
              <CardTitle>Dane osobowe</CardTitle>
              <CardDescription>
                Informacje kontaktowe i personalne pacjenta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Imię</Label>
                  <div className="font-medium">{pacjent.imie}</div>
                </div>
                <div>
                  <Label>Nazwisko</Label>
                  <div className="font-medium">{pacjent.nazwisko}</div>
                </div>
                <div>
                  <Label>Telefon</Label>
                  <div className="font-medium">{pacjent.telefon}</div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="font-medium">{pacjent.email || "-"}</div>
                </div>
                <div className="md:col-span-2">
                  <Label>Adres</Label>
                  <div className="font-medium">{pacjent.adres || "-"}</div>
                </div>
                <div>
                  <Label>Numer PESEL</Label>
                  <div className="font-medium">
                    {pacjent.brakPesel ? (
                      <span className="text-gray-500 italic">Brak numeru PESEL</span>
                    ) : pacjent.pesel ? (
                      <div className="flex items-center gap-2">
                        <span>{formatPESEL(pacjent.pesel)}</span>
                        {validatePESEL(pacjent.pesel) ? (
                          <span className="text-green-600 text-sm">✓ Prawidłowy</span>
                        ) : (
                          <span className="text-red-600 text-sm">✗ Nieprawidłowy</span>
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label>Notatki ogólne</Label>
                  <div className="font-medium whitespace-pre-wrap">
                    {pacjent.notatkiOgolne || "Brak notatek"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zakładka z historią wizyt */}
        <TabsContent value="wizyty">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Historia wizyt</CardTitle>
                <CardDescription>
                  Lista wszystkich wizyt pacjenta
                </CardDescription>
              </div>
              <Button onClick={handleNowaWizyta}>
                <PlusIcon className="h-4 w-4 mr-2" /> Dodaj wizytę
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full pr-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Godzina</TableHead>
                      <TableHead>Rodzaj</TableHead>
                      <TableHead>Notatki</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pacjent.wizyty.length > 0 ? (
                      pacjent.wizyty
                        .sort((a, b) => b.data.getTime() - a.data.getTime())
                        .map((wizyta) => (
                          <TableRow key={wizyta.id} className={getVisitBackgroundColor(wizyta.status)}>
                            <TableCell>
                              {format(wizyta.data, "dd.MM.yyyy", {
                                locale: pl,
                              })}
                            </TableCell>
                            <TableCell>
                              {format(wizyta.data, "HH:mm")}
                            </TableCell>
                            <TableCell>{wizyta.rodzaj}</TableCell>
                            <TableCell className="max-w-xs">
                              <div className="truncate" title={wizyta.notatki}>
                                {wizyta.notatki || "-"}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdytujWizyte(wizyta)}
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUsunWizyte(wizyta.id)}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-4 text-muted-foreground"
                        >
                          Brak historii wizyt
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Dialog edycji danych pacjenta */}
      <Dialog open={edytujDane} onOpenChange={setEdytujDane}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edytuj dane pacjenta</DialogTitle>
            <DialogDescription>
              Wprowadź zmiany w danych osobowych pacjenta
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imie">Imię</Label>
                <Input
                  id="imie"
                  name="imie"
                  value={formDane.imie}
                  onChange={handleDaneChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nazwisko">Nazwisko</Label>
                <Input
                  id="nazwisko"
                  name="nazwisko"
                  value={formDane.nazwisko}
                  onChange={handleDaneChange}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefon">Telefon</Label>
                <Input
                  id="telefon"
                  name="telefon"
                  value={formDane.telefon}
                  onChange={handleDaneChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formDane.email}
                  onChange={handleDaneChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adres">Adres</Label>
              <Textarea
                id="adres"
                name="adres"
                value={formDane.adres}
                onChange={handleDaneChange}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="brakPesel"
                  name="brakPesel"
                  checked={formDane.brakPesel}
                  onChange={handleDaneChange}
                  className="rounded"
                />
                <Label htmlFor="brakPesel">Brak numeru PESEL</Label>
              </div>
              {!formDane.brakPesel && (
                <div className="space-y-2">
                  <Label htmlFor="pesel">Numer PESEL</Label>
                  <Input
                    id="pesel"
                    name="pesel"
                    type="text"
                    value={formDane.pesel}
                    onChange={handleDaneChange}
                    placeholder="Wprowadź 11-cyfrowy numer PESEL"
                    maxLength={11}
                    className={formDane.pesel && !validatePESEL(formDane.pesel) ? "border-red-500" : ""}
                  />
                  {formDane.pesel && (
                    <div className="text-sm">
                      {validatePESEL(formDane.pesel) ? (
                        <span className="text-green-600">✓ Numer PESEL jest prawidłowy</span>
                      ) : (
                        <span className="text-red-600">✗ Numer PESEL jest nieprawidłowy</span>
                      )}
                    </div>
                  )}
                  {formDane.pesel && validatePESEL(formDane.pesel) && (
                    <div className="text-sm text-gray-600">
                      Data urodzenia: {extractDateFromPESEL(formDane.pesel) ? 
                        format(extractDateFromPESEL(formDane.pesel)!, "dd MMMM yyyy", { locale: pl }) : 
                        "Nie można wyciągnąć daty"
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="notatkiOgolne">Notatki ogólne</Label>
              <Textarea
                id="notatkiOgolne"
                name="notatkiOgolne"
                rows={4}
                value={formDane.notatkiOgolne}
                onChange={handleDaneChange}
                placeholder="Wprowadź ogólne notatki o pacjencie..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdytujDane(false)}>
              Anuluj
            </Button>
            <Button onClick={handleDaneSubmit}>Zapisz zmiany</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog dodawania/edycji wizyty */}
      <Dialog open={nowaWizyta} onOpenChange={handleCloseWizyta}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {edytowanaWizyta ? "Edytuj wizytę" : "Dodaj nową wizytę"}
            </DialogTitle>
            <DialogDescription>
              {edytowanaWizyta
                ? "Wprowadź zmiany w danych wizyty"
                : "Wprowadź dane nowej wizyty"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data">Data</Label>
                <Input
                  id="data"
                  name="data"
                  type="date"
                  value={formWizyta.data}
                  onChange={handleWizytaChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="czas">Godzina</Label>
                <Input
                  id="czas"
                  name="czas"
                  type="time"
                  value={formWizyta.czas}
                  onChange={handleWizytaChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rodzaj">Rodzaj wizyty</Label>
              <Input
                id="rodzaj"
                name="rodzaj"
                value={formWizyta.rodzaj}
                onChange={handleWizytaChange}
                placeholder="np. Przegląd, Leczenie kanałowe, Higienizacja"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notatki">Notatki z wizyty</Label>
              <Textarea
                id="notatki"
                name="notatki"
                value={formWizyta.notatki}
                onChange={handleWizytaChange}
                placeholder="Wprowadź notatki z wizyty..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNowaWizyta(false);
                setEdytowanaWizyta(null);
              }}
            >
              Anuluj
            </Button>
            <Button onClick={handleWizytaSubmit}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default KartaPacjenta;
