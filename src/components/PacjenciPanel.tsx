import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Edit, Trash2, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase, type Pacjent } from "@/lib/supabase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";


interface PacjenciPanelProps {
  onPatientSelect?: (patientId: string) => void;
  prefilledName?: string;
  onNameUsed?: () => void;
}

const PacjenciPanel = ({
  onPatientSelect,
  prefilledName = "",
  onNameUsed,
}: PacjenciPanelProps = {}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentPacjent, setCurrentPacjent] = useState<Pacjent | null>(null);
  const [sortBy, setSortBy] = useState<string>("nazwisko");
  const [initialFormData, setInitialFormData] = useState<{
    imie: string;
    nazwisko: string;
  }>({ imie: "", nazwisko: "" });
  const [pacjenci, setPacjenci] = useState<Pacjent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch pacjenci from database
  const fetchPacjenci = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("pacjenci")
        .select("*")
        .order("nazwisko");

      if (error) throw error;
      setPacjenci(data || []);
    } catch (err) {
      console.error("Error fetching pacjenci:", err);
      setError("Błąd podczas pobierania listy pacjentów");
    } finally {
      setLoading(false);
    }
  };

  // Load pacjenci on component mount
  useEffect(() => {
    fetchPacjenci();
  }, []);

  const handleAddPacjent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      setLoading(true);
          const { data, error } = await supabase
            .from("pacjenci")
            .insert({
              imie: formData.get("imie") as string,
              nazwisko: formData.get("nazwisko") as string,
              telefon: formData.get("telefon") as string,
              notatki: (formData.get("notatki") as string) || "",
              adres: (formData.get("adres") as string) || null,
              data_urodzenia: (formData.get("dataUrodzenia") as string) || null,
              email: (formData.get("email") as string) || null,
            })
        .select()
        .single();

      if (error) throw error;
      
      setPacjenci([...pacjenci, data]);
      setIsAddDialogOpen(false);
      setInitialFormData({ imie: "", nazwisko: "" });
      
      // Clear the prefilled name after use
      if (onNameUsed) {
        onNameUsed();
      }
    } catch (err) {
      console.error("Error adding pacjent:", err);
      setError("Błąd podczas dodawania pacjenta");
    } finally {
      setLoading(false);
    }
  };

  const handleEditPacjent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentPacjent) return;

    const formData = new FormData(e.currentTarget);
    
    try {
      setLoading(true);
          const { data, error } = await supabase
            .from("pacjenci")
            .update({
              imie: formData.get("imie") as string,
              nazwisko: formData.get("nazwisko") as string,
              telefon: formData.get("telefon") as string,
              notatki: (formData.get("notatki") as string) || "",
              adres: (formData.get("adres") as string) || null,
              data_urodzenia: (formData.get("dataUrodzenia") as string) || null,
              email: (formData.get("email") as string) || null,
            })
        .eq("id", currentPacjent.id)
        .select()
        .single();

      if (error) throw error;

      setPacjenci(
        pacjenci.map((p) => (p.id === currentPacjent.id ? data : p)),
      );
      setIsEditDialogOpen(false);
      setCurrentPacjent(null);
    } catch (err) {
      console.error("Error updating pacjent:", err);
      setError("Błąd podczas aktualizacji pacjenta");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePacjent = async (id: string) => {
    if (window.confirm("Czy na pewno chcesz usunąć tego pacjenta?")) {
      try {
        setLoading(true);
        const { error } = await supabase
          .from("pacjenci")
          .delete()
          .eq("id", id);

        if (error) throw error;

        setPacjenci(pacjenci.filter((p) => p.id !== id));
      } catch (err) {
        console.error("Error deleting pacjent:", err);
        setError("Błąd podczas usuwania pacjenta");
      } finally {
        setLoading(false);
      }
    }
  };

  const openEditDialog = (pacjent: Pacjent) => {
    setCurrentPacjent(pacjent);
    setIsEditDialogOpen(true);
  };

  const filteredPacjenci = pacjenci
    .filter(
      (pacjent) =>
        pacjent.imie.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pacjent.nazwisko.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pacjent.telefon.includes(searchTerm),
    )
    .sort((a, b) => {
      if (sortBy === "imie") return a.imie.localeCompare(b.imie);
      if (sortBy === "nazwisko") return a.nazwisko.localeCompare(b.nazwisko);
      if (sortBy === "telefon") return a.telefon.localeCompare(b.telefon);
      return 0;
    });

  // Handle prefilled name from appointment scheduling
  React.useEffect(() => {
    console.log("PacjenciPanel received prefilledName:", prefilledName);
    if (prefilledName && prefilledName.trim()) {
      const nameParts = prefilledName.trim().split(" ");
      const imie = nameParts[0] || "";
      const nazwisko = nameParts.slice(1).join(" ") || "";

      console.log("Setting initial form data:", { imie, nazwisko });
      setInitialFormData({ imie, nazwisko });

      // Open the add dialog immediately
      setIsAddDialogOpen(true);
    }
  }, [prefilledName]);

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm w-full">
      {error && (
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl font-bold">
            Panel Zarządzania Pacjentami
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="relative w-full md:w-1/3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj pacjenta..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sortuj według" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="imie">Imię</SelectItem>
                    <SelectItem value="nazwisko">Nazwisko</SelectItem>
                    <SelectItem value="telefon">Telefon</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" /> Dodaj Pacjenta
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dodaj Nowego Pacjenta</DialogTitle>
                    <DialogDescription>
                      Wprowadź dane nowego pacjenta w poniższym formularzu.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddPacjent}>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="imie" className="text-right">
                          Imię
                        </Label>
                        <Input
                          id="imie"
                          name="imie"
                          className="col-span-3"
                          defaultValue={initialFormData.imie}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nazwisko" className="text-right">
                          Nazwisko
                        </Label>
                        <Input
                          id="nazwisko"
                          name="nazwisko"
                          className="col-span-3"
                          defaultValue={initialFormData.nazwisko}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="telefon" className="text-right">
                          Telefon
                        </Label>
                        <Input
                          id="telefon"
                          name="telefon"
                          className="col-span-3"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                          Email
                        </Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          className="col-span-3"
                          placeholder="adres@email.com"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="adres" className="text-right">
                          Adres
                        </Label>
                        <Input
                          id="adres"
                          name="adres"
                          className="col-span-3"
                          placeholder="ul. Przykładowa 123, 00-000 Miasto"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="dataUrodzenia" className="text-right">
                          Data urodzenia
                        </Label>
                        <Input
                          id="dataUrodzenia"
                          name="dataUrodzenia"
                          type="date"
                          className="col-span-3"
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="notatki" className="text-right">
                          Notatki
                        </Label>
                        <Input
                          id="notatki"
                          name="notatki"
                          className="col-span-3"
                          placeholder="Opcjonalne notatki o pacjencie"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={loading}>
                        {loading ? "Zapisywanie..." : "Zapisz"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imię</TableHead>
                  <TableHead>Nazwisko</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Notatki</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-muted-foreground"
                    >
                      Ładowanie pacjentów...
                    </TableCell>
                  </TableRow>
                ) : filteredPacjenci.length > 0 ? (
                  filteredPacjenci.map((pacjent) => (
                    <TableRow
                      key={pacjent.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onPatientSelect?.(pacjent.id)}
                    >
                      <TableCell>{pacjent.imie}</TableCell>
                      <TableCell>{pacjent.nazwisko}</TableCell>
                      <TableCell>{pacjent.telefon}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {pacjent.notatki || "Brak notatek"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(pacjent);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePacjent(pacjent.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-muted-foreground"
                    >
                      Nie znaleziono pacjentów
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog edycji pacjenta */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj Dane Pacjenta</DialogTitle>
            <DialogDescription>
              Zaktualizuj dane pacjenta w poniższym formularzu.
            </DialogDescription>
          </DialogHeader>
          {currentPacjent && (
            <form onSubmit={handleEditPacjent}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-imie" className="text-right">
                    Imię
                  </Label>
                  <Input
                    id="edit-imie"
                    name="imie"
                    className="col-span-3"
                    defaultValue={currentPacjent.imie}
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-nazwisko" className="text-right">
                    Nazwisko
                  </Label>
                  <Input
                    id="edit-nazwisko"
                    name="nazwisko"
                    className="col-span-3"
                    defaultValue={currentPacjent.nazwisko}
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-telefon" className="text-right">
                    Telefon
                  </Label>
                  <Input
                    id="edit-telefon"
                    name="telefon"
                    className="col-span-3"
                    defaultValue={currentPacjent.telefon}
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-email" className="text-right">
                    Email
                  </Label>
                  <Input
                    id="edit-email"
                    name="email"
                    type="email"
                    className="col-span-3"
                    defaultValue={currentPacjent.email || ""}
                    placeholder="adres@email.com"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-adres" className="text-right">
                    Adres
                  </Label>
                  <Input
                    id="edit-adres"
                    name="adres"
                    className="col-span-3"
                    defaultValue={currentPacjent.adres || ""}
                    placeholder="ul. Przykładowa 123, 00-000 Miasto"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-dataUrodzenia" className="text-right">
                    Data urodzenia
                  </Label>
                  <Input
                    id="edit-dataUrodzenia"
                    name="dataUrodzenia"
                    type="date"
                    className="col-span-3"
                    defaultValue={currentPacjent.data_urodzenia ? new Date(currentPacjent.data_urodzenia).toISOString().split('T')[0] : ""}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-notatki" className="text-right">
                    Notatki
                  </Label>
                  <Input
                    id="edit-notatki"
                    name="notatki"
                    className="col-span-3"
                    defaultValue={currentPacjent.notatki || ""}
                    placeholder="Opcjonalne notatki o pacjencie"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={loading}>
                  {loading ? "Zapisywanie..." : "Zapisz zmiany"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PacjenciPanel;