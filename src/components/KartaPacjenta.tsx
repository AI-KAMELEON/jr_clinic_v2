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

interface Wizyta {
  id: string;
  data: Date;
  opis: string;
  zabiegi: string;
}

interface Notatka {
  id: string;
  data: Date;
  tresc: string;
}

interface Pacjent {
  id: string;
  imie: string;
  nazwisko: string;
  telefon: string;
  email: string;
  adres: string;
  dataUrodzenia: Date | null;
  wizyty: Wizyta[];
  notatki: Notatka[];
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
          setPacjent({
            id: data.id,
            imie: data.imie,
            nazwisko: data.nazwisko,
            telefon: data.telefon,
            email: data.email || '',
            adres: data.adres || '',
            dataUrodzenia: data.data_urodzenia ? new Date(data.data_urodzenia) : null,
            notatkiOgolne: data.notatki || '',
            wizyty: [], // TODO: Pobierz wizyty
            notatki: [], // TODO: Pobierz notatki
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

  if (loading) {
    return <div>Ładowanie danych pacjenta...</div>;
  }

  if (!pacjent) {
    return <div>Nie znaleziono pacjenta</div>;
  }

  // Użyj danych pobranych z Supabase
  const [edytujDane, setEdytujDane] = useState(false);
  const [nowaWizyta, setNowaWizyta] = useState(false);
  const [nowaNotatka, setNowaNotatka] = useState(false);
  const [edytowanaWizyta, setEdytowanaWizyta] = useState<Wizyta | null>(null);
  const [edytowanaNotatka, setEdytowanaNotatka] = useState<Notatka | null>(
    null,
  );

  // Formularz danych pacjenta
  const [formDane, setFormDane] = useState({
    imie: pacjent.imie,
    nazwisko: pacjent.nazwisko,
    telefon: pacjent.telefon,
    email: pacjent.email,
    adres: pacjent.adres,
    dataUrodzenia: pacjent.dataUrodzenia
      ? format(pacjent.dataUrodzenia, "yyyy-MM-dd")
      : "",
    notatkiOgolne: pacjent.notatkiOgolne || "",
  });

  // Formularz wizyty
  const [formWizyta, setFormWizyta] = useState({
    data: "",
    czas: "",
    opis: "",
    zabiegi: "",
  });

  // Formularz notatki
  const [formNotatka, setFormNotatka] = useState({
    tresc: "",
  });

  // Obsługa formularza danych pacjenta
  const handleDaneChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormDane((prev) => ({ ...prev, [name]: value }));
  };

  const handleDaneSubmit = () => {
    const updatedPacjent = {
      ...pacjent,
      imie: formDane.imie,
      nazwisko: formDane.nazwisko,
      telefon: formDane.telefon,
      email: formDane.email,
      adres: formDane.adres,
      dataUrodzenia: formDane.dataUrodzenia
        ? new Date(formDane.dataUrodzenia)
        : null,
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

  const handleWizytaSubmit = () => {
    const dataCzas = new Date(`${formWizyta.data}T${formWizyta.czas}`);

    if (edytowanaWizyta) {
      // Edycja istniejącej wizyty
      const updatedWizyty = pacjent.wizyty.map((w) =>
        w.id === edytowanaWizyta.id
          ? {
              ...w,
              data: dataCzas,
              opis: formWizyta.opis,
              zabiegi: formWizyta.zabiegi,
            }
          : w,
      );
      setPacjent({ ...pacjent, wizyty: updatedWizyty });
      setEdytowanaWizyta(null);
    } else {
      // Dodanie nowej wizyty
      const nowaWizyta: Wizyta = {
        id: `w${Date.now()}`,
        data: dataCzas,
        opis: formWizyta.opis,
        zabiegi: formWizyta.zabiegi,
      };
      setPacjent({ ...pacjent, wizyty: [...pacjent.wizyty, nowaWizyta] });
    }

    setNowaWizyta(false);
    setFormWizyta({ data: "", czas: "", opis: "", zabiegi: "" });
  };

  // Obsługa formularza notatki
  const handleNotatkaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormNotatka({ tresc: e.target.value });
  };

  const handleNotatkaSubmit = () => {
    if (edytowanaNotatka) {
      // Edycja istniejącej notatki
      const updatedNotatki = pacjent.notatki.map((n) =>
        n.id === edytowanaNotatka.id
          ? { ...n, tresc: formNotatka.tresc, data: new Date() }
          : n,
      );
      setPacjent({ ...pacjent, notatki: updatedNotatki });
      setEdytowanaNotatka(null);
    } else {
      // Dodanie nowej notatki
      const nowaNotatka: Notatka = {
        id: `n${Date.now()}`,
        data: new Date(),
        tresc: formNotatka.tresc,
      };
      setPacjent({ ...pacjent, notatki: [...pacjent.notatki, nowaNotatka] });
    }

    setNowaNotatka(false);
    setFormNotatka({ tresc: "" });
  };

  // Usuwanie wizyty
  const handleUsunWizyte = (id: string) => {
    const updatedWizyty = pacjent.wizyty.filter((w) => w.id !== id);
    setPacjent({ ...pacjent, wizyty: updatedWizyty });
  };

  // Usuwanie notatki
  const handleUsunNotatke = (id: string) => {
    const updatedNotatki = pacjent.notatki.filter((n) => n.id !== id);
    setPacjent({ ...pacjent, notatki: updatedNotatki });
  };

  // Edycja wizyty
  const handleEdytujWizyte = (wizyta: Wizyta) => {
    setEdytowanaWizyta(wizyta);
    setFormWizyta({
      data: format(wizyta.data, "yyyy-MM-dd"),
      czas: format(wizyta.data, "HH:mm"),
      opis: wizyta.opis,
      zabiegi: wizyta.zabiegi,
    });
    setNowaWizyta(true);
  };

  // Edycja notatki
  const handleEdytujNotatke = (notatka: Notatka) => {
    setEdytowanaNotatka(notatka);
    setFormNotatka({ tresc: notatka.tresc });
    setNowaNotatka(true);
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
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="dane">Dane osobowe</TabsTrigger>
          <TabsTrigger value="wizyty">Historia wizyt</TabsTrigger>
          <TabsTrigger value="notatki">Notatki wizyt</TabsTrigger>
          <TabsTrigger value="notatki-ogolne">Notatki ogólne</TabsTrigger>
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
                  <Label>Data urodzenia</Label>
                  <div className="font-medium">
                    {pacjent.dataUrodzenia
                      ? format(pacjent.dataUrodzenia, "dd MMMM yyyy", {
                          locale: pl,
                        })
                      : "-"}
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
              <Button
                onClick={() => {
                  setNowaWizyta(true);
                  setEdytowanaWizyta(null);
                  setFormWizyta({ data: "", czas: "", opis: "", zabiegi: "" });
                }}
              >
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
                      <TableHead>Opis</TableHead>
                      <TableHead>Zabiegi</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pacjent.wizyty.length > 0 ? (
                      pacjent.wizyty
                        .sort((a, b) => b.data.getTime() - a.data.getTime())
                        .map((wizyta) => (
                          <TableRow key={wizyta.id}>
                            <TableCell>
                              {format(wizyta.data, "dd.MM.yyyy", {
                                locale: pl,
                              })}
                            </TableCell>
                            <TableCell>
                              {format(wizyta.data, "HH:mm")}
                            </TableCell>
                            <TableCell>{wizyta.opis}</TableCell>
                            <TableCell>{wizyta.zabiegi}</TableCell>
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

        {/* Zakładka z notatkami wizyt */}
        <TabsContent value="notatki">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Notatki wizyt</CardTitle>
                <CardDescription>
                  Notatki związane z konkretnymi wizytami
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  setNowaNotatka(true);
                  setEdytowanaNotatka(null);
                  setFormNotatka({ tresc: "" });
                }}
              >
                <PlusIcon className="h-4 w-4 mr-2" /> Dodaj notatkę
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full pr-4">
                {pacjent.notatki.length > 0 ? (
                  <div className="space-y-4">
                    {pacjent.notatki
                      .sort((a, b) => b.data.getTime() - a.data.getTime())
                      .map((notatka) => (
                        <Card key={notatka.id}>
                          <CardHeader className="py-3">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center text-sm text-muted-foreground">
                                <CalendarIcon className="h-4 w-4 mr-2" />
                                {format(notatka.data, "dd MMMM yyyy", {
                                  locale: pl,
                                })}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdytujNotatke(notatka)}
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUsunNotatke(notatka.id)}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="py-2">
                            <p className="whitespace-pre-wrap">
                              {notatka.tresc}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Brak notatek dla tego pacjenta
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zakładka z notatkami ogólnymi */}
        <TabsContent value="notatki-ogolne">
          <Card>
            <CardHeader>
              <CardTitle>Notatki ogólne</CardTitle>
              <CardDescription>
                Ogólne informacje i uwagi dotyczące pacjenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="whitespace-pre-wrap">
                    {pacjent.notatkiOgolne || "Brak notatek ogólnych"}
                  </div>
                </div>
                <Button onClick={() => setEdytujDane(true)} variant="outline">
                  <PencilIcon className="h-4 w-4 mr-2" /> Edytuj notatki
                </Button>
              </div>
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
              <Label htmlFor="dataUrodzenia">Data urodzenia</Label>
              <Input
                id="dataUrodzenia"
                name="dataUrodzenia"
                type="date"
                value={formDane.dataUrodzenia}
                onChange={handleDaneChange}
              />
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
      <Dialog open={nowaWizyta} onOpenChange={setNowaWizyta}>
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
              <Label htmlFor="opis">Opis wizyty</Label>
              <Input
                id="opis"
                name="opis"
                value={formWizyta.opis}
                onChange={handleWizytaChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zabiegi">Wykonane zabiegi</Label>
              <Textarea
                id="zabiegi"
                name="zabiegi"
                value={formWizyta.zabiegi}
                onChange={handleWizytaChange}
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

      {/* Dialog dodawania/edycji notatki */}
      <Dialog open={nowaNotatka} onOpenChange={setNowaNotatka}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {edytowanaNotatka ? "Edytuj notatkę" : "Dodaj nową notatkę"}
            </DialogTitle>
            <DialogDescription>
              {edytowanaNotatka
                ? "Wprowadź zmiany w notatce"
                : "Wprowadź treść nowej notatki"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tresc">Treść notatki</Label>
              <Textarea
                id="tresc"
                name="tresc"
                rows={6}
                value={formNotatka.tresc}
                onChange={handleNotatkaChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNowaNotatka(false);
                setEdytowanaNotatka(null);
              }}
            >
              Anuluj
            </Button>
            <Button onClick={handleNotatkaSubmit}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KartaPacjenta;
