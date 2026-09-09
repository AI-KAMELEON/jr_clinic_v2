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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarIcon, PencilIcon, PlusIcon, TrashIcon, AlertTriangle, Clock } from "lucide-react";
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


interface WizytaCitoRecord {
  id: string;
  powod: string;
  notatki: string;
  status: string;
  kolejnosc: number;
  created_at: string | null;
}

interface WizytaDodatkowaRecord {
  id: string;
  data: string;
  rodzaj: string;
  notatki: string;
  status: string;
  kolejnosc: number;
  created_at: string | null;
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
  wizytyCito: WizytaCitoRecord[];
  wizytyDodatkowe: WizytaDodatkowaRecord[];
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
            status: (wizyta.status || 'zaplanowana') as VisitStatus
          })) || [];

          const { data: citoData } = await supabase
            .from('wizyty_cito')
            .select('*')
            .eq('pacjent_id', pacjentId)
            .order('created_at', { ascending: false });

          const { data: dodatkoweData } = await supabase
            .from('wizyty_dodatkowe')
            .select('*')
            .eq('pacjent_id', pacjentId)
            .order('data', { ascending: false })
            .order('kolejnosc', { ascending: true });

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
            wizytyCito: (citoData || []).map((c) => ({
              id: c.id,
              powod: c.powod || '',
              notatki: c.notatki || '',
              status: c.status,
              kolejnosc: c.kolejnosc,
              created_at: c.created_at,
            })),
            wizytyDodatkowe: (dodatkoweData || []).map((d) => ({
              id: d.id,
              data: d.data,
              rodzaj: d.rodzaj,
              notatki: d.notatki || '',
              status: d.status,
              kolejnosc: d.kolejnosc,
              created_at: d.created_at,
            })),
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [wizytaToDelete, setWizytaToDelete] = useState<string | null>(null);
  const [duplicatePeselDialog, setDuplicatePeselDialog] = useState(false);
  const [duplicatePeselMessage, setDuplicatePeselMessage] = useState('');
  const [citoDialogOpen, setCitoDialogOpen] = useState(false);
  const [dodatkowaDialogOpen, setDodatkowaDialogOpen] = useState(false);
  const [citoDuplicateDialog, setCitoDuplicateDialog] = useState(false);
  const [edytowaneCito, setEdytowaneCito] = useState<WizytaCitoRecord | null>(null);
  const [edytowanaDodatkowa, setEdytowanaDodatkowa] = useState<WizytaDodatkowaRecord | null>(null);
  const [deleteCitoDialogOpen, setDeleteCitoDialogOpen] = useState(false);
  const [citoToDelete, setCitoToDelete] = useState<string | null>(null);
  const [deleteDodatkowaDialogOpen, setDeleteDodatkowaDialogOpen] = useState(false);
  const [dodatkowaToDelete, setDodatkowaToDelete] = useState<string | null>(null);
  const [formCito, setFormCito] = useState({ powod: '', notatki: '' });
  const [formDodatkowa, setFormDodatkowa] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    rodzaj: '',
    notatki: '',
  });

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

  const handleDaneSubmit = async () => {
    try {
      // Sprawdź czy pacjent o takim PESEL już istnieje (ale nie ten sam pacjent)
      if (formDane.pesel && !formDane.brakPesel) {
        const { data: existingPatient, error: checkError } = await supabase
          .from("pacjenci")
          .select("id, imie, nazwisko")
          .eq("pesel", formDane.pesel)
          .neq("id", pacjentId) // Wyklucz aktualnie edytowanego pacjenta
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
          throw checkError;
        }
        
        if (existingPatient) {
          setDuplicatePeselMessage(`Pacjent o numerze PESEL ${formDane.pesel} już istnieje w bazie danych (${existingPatient.imie} ${existingPatient.nazwisko})`);
          setDuplicatePeselDialog(true);
          return;
        }
      }
      
      // Przygotuj dane do aktualizacji
      const updateData = {
        imie: formDane.imie,
        nazwisko: formDane.nazwisko,
        telefon: formDane.telefon,
        email: formDane.email,
        adres: formDane.adres,
        pesel: formDane.brakPesel ? null : formDane.pesel,
        brak_pesel: formDane.brakPesel,
        notatki: formDane.notatkiOgolne,
      };

      // Zapisz do bazy danych
      const { error } = await supabase
        .from('pacjenci')
        .update(updateData)
        .eq('id', pacjentId);

      if (error) {
        console.error('Error updating patient:', error);
        
        // Sprawdź czy to błąd duplikatu PESEL
        if (error.code === '23505' && error.message.includes('idx_pacjenci_pesel_unique')) {
          setDuplicatePeselMessage(`Pacjent o numerze PESEL ${formDane.pesel} już istnieje w bazie danych`);
          setDuplicatePeselDialog(true);
        } else {
          alert('Błąd podczas zapisywania danych pacjenta');
        }
        return;
      }

      // Aktualizuj lokalny stan
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
      
      console.log('Dane pacjenta zostały zaktualizowane');
    } catch (err) {
      console.error('Error updating patient:', err);
      alert('Wystąpił błąd podczas zapisywania');
    }
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
            godzina_od: formWizyta.czas,
            godzina_do: formWizyta.czas,
            rodzaj: formWizyta.rodzaj,
            notatki: formWizyta.notatki || null
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


  // Usuwanie wizyty - otwórz dialog potwierdzenia
  const handleUsunWizyte = (id: string) => {
    setWizytaToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Potwierdź usunięcie wizyty
  const confirmDeleteWizyta = async () => {
    if (!wizytaToDelete) return;
    
    try {
      const { error } = await supabase
        .from('wizyty')
        .delete()
        .eq('id', wizytaToDelete);

      if (error) throw error;

      const updatedWizyty = pacjent.wizyty.filter((w) => w.id !== wizytaToDelete);
      setPacjent({ ...pacjent, wizyty: updatedWizyty });
      
      setDeleteDialogOpen(false);
      setWizytaToDelete(null);
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

  const hasActiveCito = pacjent.wizytyCito.some((w) => w.status === 'oczekujaca');

  const handleOznaczCito = async () => {
    if (hasActiveCito) {
      setCitoDuplicateDialog(true);
      return;
    }
    setEdytowaneCito(null);
    setFormCito({ powod: '', notatki: '' });
    setCitoDialogOpen(true);
  };

  const handleEdytujCito = (cito: WizytaCitoRecord) => {
    setEdytowaneCito(cito);
    setFormCito({ powod: cito.powod || '', notatki: cito.notatki || '' });
    setCitoDialogOpen(true);
  };

  const handleUsunCito = (id: string) => {
    setCitoToDelete(id);
    setDeleteCitoDialogOpen(true);
  };

  const confirmDeleteCito = async () => {
    if (!citoToDelete) return;
    try {
      const { error } = await supabase
        .from('wizyty_cito')
        .delete()
        .eq('id', citoToDelete);
      if (error) throw error;
      setPacjent({
        ...pacjent,
        wizytyCito: pacjent.wizytyCito.filter((w) => w.id !== citoToDelete),
      });
      setDeleteCitoDialogOpen(false);
      setCitoToDelete(null);
    } catch (error) {
      console.error('Error deleting cito visit:', error);
      alert('Błąd podczas usuwania wizyty Cito');
    }
  };

  const handleCitoSubmit = async () => {
    try {
      if (edytowaneCito) {
        const { error } = await supabase
          .from('wizyty_cito')
          .update({
            powod: formCito.powod || null,
            notatki: formCito.notatki || null,
          })
          .eq('id', edytowaneCito.id);

        if (error) throw error;

        setPacjent({
          ...pacjent,
          wizytyCito: pacjent.wizytyCito.map((w) =>
            w.id === edytowaneCito.id
              ? { ...w, powod: formCito.powod, notatki: formCito.notatki }
              : w,
          ),
        });
        setCitoDialogOpen(false);
        setEdytowaneCito(null);
        setFormCito({ powod: '', notatki: '' });
        return;
      }

      const { data: existing } = await supabase
        .from('wizyty_cito')
        .select('id')
        .eq('pacjent_id', pacjentId)
        .eq('status', 'oczekujaca')
        .maybeSingle();

      if (existing) {
        setCitoDuplicateDialog(true);
        setCitoDialogOpen(false);
        return;
      }

      const { data: maxOrderData } = await supabase
        .from('wizyty_cito')
        .select('kolejnosc')
        .eq('status', 'oczekujaca')
        .order('kolejnosc', { ascending: false })
        .limit(1);

      const nextOrder = (maxOrderData?.[0]?.kolejnosc || 0) + 1;

      const { data: newCito, error } = await supabase
        .from('wizyty_cito')
        .insert({
          pacjent_id: pacjentId,
          kolejnosc: nextOrder,
          powod: formCito.powod || null,
          notatki: formCito.notatki || null,
          status: 'oczekujaca',
        })
        .select()
        .single();

      if (error) throw error;

      setPacjent({
        ...pacjent,
        wizytyCito: [
          {
            id: newCito.id,
            powod: formCito.powod,
            notatki: formCito.notatki,
            status: 'oczekujaca',
            kolejnosc: nextOrder,
            created_at: newCito.created_at,
          },
          ...pacjent.wizytyCito,
        ],
      });
      setCitoDialogOpen(false);
      setFormCito({ powod: '', notatki: '' });
    } catch (error) {
      console.error('Error saving cito visit:', error);
      alert(edytowaneCito ? 'Błąd podczas edycji wizyty Cito' : 'Błąd podczas dodawania do listy Cito');
    }
  };

  const handleDodatkowaWizyta = () => {
    setEdytowanaDodatkowa(null);
    setFormDodatkowa({
      data: format(new Date(), 'yyyy-MM-dd'),
      rodzaj: '',
      notatki: '',
    });
    setDodatkowaDialogOpen(true);
  };

  const handleEdytujDodatkowa = (wizyta: WizytaDodatkowaRecord) => {
    setEdytowanaDodatkowa(wizyta);
    setFormDodatkowa({
      data: wizyta.data,
      rodzaj: wizyta.rodzaj,
      notatki: wizyta.notatki || '',
    });
    setDodatkowaDialogOpen(true);
  };

  const handleUsunDodatkowa = (id: string) => {
    setDodatkowaToDelete(id);
    setDeleteDodatkowaDialogOpen(true);
  };

  const confirmDeleteDodatkowa = async () => {
    if (!dodatkowaToDelete) return;
    try {
      const { error } = await supabase
        .from('wizyty_dodatkowe')
        .delete()
        .eq('id', dodatkowaToDelete);
      if (error) throw error;
      setPacjent({
        ...pacjent,
        wizytyDodatkowe: pacjent.wizytyDodatkowe.filter((w) => w.id !== dodatkowaToDelete),
      });
      setDeleteDodatkowaDialogOpen(false);
      setDodatkowaToDelete(null);
    } catch (error) {
      console.error('Error deleting additional visit:', error);
      alert('Błąd podczas usuwania wizyty dodatkowej');
    }
  };

  const handleDodatkowaSubmit = async () => {
    try {
      if (edytowanaDodatkowa) {
        const { error } = await supabase
          .from('wizyty_dodatkowe')
          .update({
            data: formDodatkowa.data,
            rodzaj: formDodatkowa.rodzaj,
            notatki: formDodatkowa.notatki || null,
          })
          .eq('id', edytowanaDodatkowa.id);

        if (error) throw error;

        setPacjent({
          ...pacjent,
          wizytyDodatkowe: pacjent.wizytyDodatkowe.map((w) =>
            w.id === edytowanaDodatkowa.id
              ? {
                  ...w,
                  data: formDodatkowa.data,
                  rodzaj: formDodatkowa.rodzaj,
                  notatki: formDodatkowa.notatki,
                }
              : w,
          ),
        });
        setDodatkowaDialogOpen(false);
        setEdytowanaDodatkowa(null);
        return;
      }

      const { data: maxOrderData } = await supabase
        .from('wizyty_dodatkowe')
        .select('kolejnosc')
        .eq('data', formDodatkowa.data)
        .order('kolejnosc', { ascending: false })
        .limit(1);

      const nextOrder = (maxOrderData?.[0]?.kolejnosc || 0) + 1;

      const { data: newDodatkowa, error } = await supabase
        .from('wizyty_dodatkowe')
        .insert({
          pacjent_id: pacjentId,
          data: formDodatkowa.data,
          rodzaj: formDodatkowa.rodzaj,
          notatki: formDodatkowa.notatki || null,
          status: 'zaplanowana',
          kolejnosc: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;

      setPacjent({
        ...pacjent,
        wizytyDodatkowe: [
          {
            id: newDodatkowa.id,
            data: formDodatkowa.data,
            rodzaj: formDodatkowa.rodzaj,
            notatki: formDodatkowa.notatki,
            status: 'zaplanowana',
            kolejnosc: nextOrder,
            created_at: newDodatkowa.created_at,
          },
          ...pacjent.wizytyDodatkowe,
        ],
      });
      setDodatkowaDialogOpen(false);
    } catch (error) {
      console.error('Error saving additional visit:', error);
      alert(edytowanaDodatkowa ? 'Błąd podczas edycji wizyty dodatkowej' : 'Błąd podczas dodawania wizyty dodatkowej');
    }
  };


  return (
    <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold text-gray-800">
          Karta Pacjenta: {pacjent.imie} {pacjent.nazwisko}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleOznaczCito} variant="outline" className="text-orange-600 border-orange-300">
            <AlertTriangle className="h-4 w-4 mr-2" /> Oznacz jako Cito
          </Button>
          <Button onClick={handleDodatkowaWizyta} variant="outline">
            <Clock className="h-4 w-4 mr-2" /> Wizyta dodatkowa
          </Button>
          <Button onClick={() => setEdytujDane(true)} variant="outline">
            <PencilIcon className="h-4 w-4 mr-2" /> Edytuj dane
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dane" className="w-full">
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="dane">Dane osobowe</TabsTrigger>
          <TabsTrigger value="wizyty">Historia wizyt</TabsTrigger>
          <TabsTrigger value="cito">Wizyty Cito</TabsTrigger>
          <TabsTrigger value="dodatkowe">Wizyty dodatkowe</TabsTrigger>
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

        <TabsContent value="cito">
          <Card>
            <CardHeader>
              <CardTitle>Wizyty Cito</CardTitle>
              <CardDescription>Historia wpisów pilnych dla tego pacjenta</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full pr-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data dodania</TableHead>
                      <TableHead>Pozycja</TableHead>
                      <TableHead>Powód</TableHead>
                      <TableHead>Notatki</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pacjent.wizytyCito.length > 0 ? (
                      pacjent.wizytyCito.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell>
                            {w.created_at
                              ? format(new Date(w.created_at), "dd.MM.yyyy HH:mm", { locale: pl })
                              : "-"}
                          </TableCell>
                          <TableCell>{w.kolejnosc}</TableCell>
                          <TableCell>{w.powod || "-"}</TableCell>
                          <TableCell>{w.notatki || "-"}</TableCell>
                          <TableCell>{w.status}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdytujCito(w)}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUsunCito(w.id)}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                          Brak wpisów Cito
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dodatkowe">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Wizyty dodatkowe</CardTitle>
                <CardDescription>Krótkie wizyty niezależne od kalendarza</CardDescription>
              </div>
              <Button onClick={handleDodatkowaWizyta}>
                <PlusIcon className="h-4 w-4 mr-2" /> Dodaj wizytę dodatkową
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full pr-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Rodzaj</TableHead>
                      <TableHead>Notatki</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pacjent.wizytyDodatkowe.length > 0 ? (
                      pacjent.wizytyDodatkowe.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell>
                            {format(new Date(w.data + "T00:00:00"), "dd.MM.yyyy", { locale: pl })}
                          </TableCell>
                          <TableCell>{w.rodzaj}</TableCell>
                          <TableCell>{w.notatki || "-"}</TableCell>
                          <TableCell>{w.status}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdytujDodatkowa(w)}
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUsunDodatkowa(w.id)}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          Brak wizyt dodatkowych
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć wizytę?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja nie może zostać cofnięta. Wizyta zostanie trwale usunięta z historii pacjenta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteWizyta} className="bg-red-600 hover:bg-red-700">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={duplicatePeselDialog} onOpenChange={setDuplicatePeselDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplikat PESEL</AlertDialogTitle>
            <AlertDialogDescription>
              {duplicatePeselMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDuplicatePeselDialog(false)}>
              Rozumiem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={citoDialogOpen}
        onOpenChange={(open) => {
          setCitoDialogOpen(open);
          if (!open) {
            setEdytowaneCito(null);
            setFormCito({ powod: '', notatki: '' });
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{edytowaneCito ? "Edytuj wizytę Cito" : "Oznacz jako Cito"}</DialogTitle>
            <DialogDescription>
              {edytowaneCito
                ? "Zaktualizuj powód lub notatki wizyty Cito"
                : "Pacjent trafi na listę pilnych wizyt (nie blokuje kalendarza)"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="powod">Powód</Label>
              <Input
                id="powod"
                value={formCito.powod}
                onChange={(e) => setFormCito({ ...formCito, powod: e.target.value })}
                placeholder="np. ból zęba"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cito-notatki">Notatki</Label>
              <Textarea
                id="cito-notatki"
                value={formCito.notatki}
                onChange={(e) => setFormCito({ ...formCito, notatki: e.target.value })}
                placeholder="Dodatkowe uwagi..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCitoDialogOpen(false);
                setEdytowaneCito(null);
              }}
            >
              Anuluj
            </Button>
            <Button onClick={handleCitoSubmit}>
              {edytowaneCito ? "Zapisz" : "Dodaj do Cito"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dodatkowaDialogOpen}
        onOpenChange={(open) => {
          setDodatkowaDialogOpen(open);
          if (!open) setEdytowanaDodatkowa(null);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {edytowanaDodatkowa ? "Edytuj wizytę dodatkową" : "Wizyta dodatkowa"}
            </DialogTitle>
            <DialogDescription>
              Krótka wizyta widoczna w panelu wizyt dodatkowych (nie blokuje kalendarza)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dod-data">Data</Label>
              <Input
                id="dod-data"
                type="date"
                value={formDodatkowa.data}
                onChange={(e) => setFormDodatkowa({ ...formDodatkowa, data: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dod-rodzaj">Rodzaj</Label>
              <Input
                id="dod-rodzaj"
                value={formDodatkowa.rodzaj}
                onChange={(e) => setFormDodatkowa({ ...formDodatkowa, rodzaj: e.target.value })}
                placeholder="np. zdjęcie gumek"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dod-notatki">Notatki</Label>
              <Textarea
                id="dod-notatki"
                value={formDodatkowa.notatki}
                onChange={(e) => setFormDodatkowa({ ...formDodatkowa, notatki: e.target.value })}
                placeholder="Opcjonalne uwagi..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDodatkowaDialogOpen(false);
                setEdytowanaDodatkowa(null);
              }}
            >
              Anuluj
            </Button>
            <Button onClick={handleDodatkowaSubmit}>
              {edytowanaDodatkowa ? "Zapisz" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteCitoDialogOpen} onOpenChange={setDeleteCitoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć wizytę Cito?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja nie może zostać cofnięta. Wpis Cito zostanie trwale usunięty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCito} className="bg-red-600 hover:bg-red-700">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDodatkowaDialogOpen} onOpenChange={setDeleteDodatkowaDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć wizytę dodatkową?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja nie może zostać cofnięta. Wizyta dodatkowa zostanie trwale usunięta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDodatkowa} className="bg-red-600 hover:bg-red-700">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={citoDuplicateDialog} onOpenChange={setCitoDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pacjent już na liście Cito</AlertDialogTitle>
            <AlertDialogDescription>
              Ten pacjent ma już aktywny wpis na liście wizyt Cito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setCitoDuplicateDialog(false)}>Rozumiem</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default KartaPacjenta;
