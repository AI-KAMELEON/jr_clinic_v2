import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Edit, Trash2, Filter, Loader2 } from "lucide-react";
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
import { validatePESEL, extractDateFromPESEL, formatPESEL } from "@/lib/utils";

const PAGE_SIZE = 100;

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
  const [debouncedSearch, setDebouncedSearch] = useState("");
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pacjentToDelete, setPacjentToDelete] = useState<Pacjent | null>(null);
  const [duplicatePeselDialog, setDuplicatePeselDialog] = useState(false);
  const [duplicatePeselMessage, setDuplicatePeselMessage] = useState('');

  // Ref for infinite scroll sentinel element
  const sentinelRef = useRef<HTMLTableRowElement>(null);

  // Debounce search input — sends query to server after 400ms pause
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset list when search or sort changes
  useEffect(() => {
    setPacjenci([]);
    setPage(0);
    setHasMore(true);
  }, [debouncedSearch, sortBy]);

  // Core fetch function — server-side search + pagination
  const fetchPacjenci = useCallback(async (pageNum: number, search: string, sort: string, append: boolean) => {
    if (pageNum === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("pacjenci")
        .select("*")
        .order(sort)
        .range(from, to);

      if (search.trim()) {
        const term = search.trim();
        const parts = term.split(" ").filter(Boolean);

        if (parts.length >= 2) {
          // "Jan Kowalski" — szukaj po imieniu I nazwisku
          query = query
            .ilike("imie", `%${parts[0]}%`)
            .ilike("nazwisko", `%${parts[1]}%`);
        } else {
          // Jedna fraza — szukaj po imieniu, nazwisku lub telefonie
          query = query.or(
            `imie.ilike.%${term}%,nazwisko.ilike.%${term}%,telefon.ilike.%${term}%`
          );
        }
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const results = data || [];
      if (append) {
        setPacjenci(prev => [...prev, ...results]);
      } else {
        setPacjenci(results);
      }
      setHasMore(results.length === PAGE_SIZE);
    } catch (err: any) {
      console.error("Error fetching pacjenci:", err);
      setError("Błąd podczas pobierania listy pacjentów");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load and on search/sort change
  useEffect(() => {
    fetchPacjenci(0, debouncedSearch, sortBy, false);
  }, [debouncedSearch, sortBy, fetchPacjenci]);

  // Load next page when page state increments (triggered by IntersectionObserver)
  useEffect(() => {
    if (page === 0) return;
    fetchPacjenci(page, debouncedSearch, sortBy, true);
  }, [page, debouncedSearch, sortBy, fetchPacjenci]);

  // Infinite scroll — observe the sentinel row at the bottom of the table
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading]);

  const handleAddPacjent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const pesel = formData.get("pesel") as string;
    const brakPesel = formData.get("brakPesel") === "on";
    
    if (!brakPesel && pesel && !validatePESEL(pesel)) {
      setError("Nieprawidłowy numer PESEL");
      return;
    }
    
    try {
      setLoading(true);
      
      if (pesel && !brakPesel) {
        const { data: existingPatient, error: checkError } = await supabase
          .from("pacjenci")
          .select("id, imie, nazwisko")
          .eq("pesel", pesel)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }
        
        if (existingPatient) {
          setDuplicatePeselMessage(`Pacjent o numerze PESEL ${pesel} już istnieje w bazie danych (${existingPatient.imie} ${existingPatient.nazwisko})`);
          setDuplicatePeselDialog(true);
          return;
        }
      }
      
      const insertData: any = {
        imie: formData.get("imie") as string,
        nazwisko: formData.get("nazwisko") as string,
        telefon: formData.get("telefon") as string,
        notatki: (formData.get("notatki") as string) || "",
        adres: (formData.get("adres") as string) || null,
        email: (formData.get("email") as string) || null,
      };

      try {
        if (pesel && !brakPesel) {
          insertData.pesel = pesel;
          insertData.brak_pesel = false;
        } else if (brakPesel) {
          insertData.pesel = null;
          insertData.brak_pesel = true;
        }
      } catch (peselError) {
        console.log("PESEL columns may not exist, skipping PESEL data");
      }

      const { data, error } = await supabase
        .from("pacjenci")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      
      // Odśwież listę od początku żeby nowy pacjent pojawił się w odpowiednim miejscu
      setPacjenci([]);
      setPage(0);
      setHasMore(true);
      fetchPacjenci(0, debouncedSearch, sortBy, false);

      setIsAddDialogOpen(false);
      setInitialFormData({ imie: "", nazwisko: "" });
      
      if (onNameUsed) {
        onNameUsed();
      }
    } catch (err: any) {
      console.error("Error adding pacjent:", err);
      
      if (err.code === '23505' && err.message.includes('idx_pacjenci_pesel_unique')) {
        setDuplicatePeselMessage(`Pacjent o numerze PESEL ${pesel} już istnieje w bazie danych`);
        setDuplicatePeselDialog(true);
      } else {
        setError(`Błąd podczas dodawania pacjenta: ${err.message || err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditPacjent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentPacjent) return;

    const formData = new FormData(e.currentTarget);
    
    const pesel = formData.get("pesel") as string;
    const brakPesel = formData.get("brakPesel") === "on";
    
    if (!brakPesel && pesel && !validatePESEL(pesel)) {
      setError("Nieprawidłowy numer PESEL");
      return;
    }
    
    try {
      setLoading(true);
      
      if (pesel && !brakPesel) {
        const { data: existingPatient, error: checkError } = await supabase
          .from("pacjenci")
          .select("id, imie, nazwisko")
          .eq("pesel", pesel)
          .neq("id", currentPacjent.id)
          .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }
        
        if (existingPatient) {
          setDuplicatePeselMessage(`Pacjent o numerze PESEL ${pesel} już istnieje w bazie danych (${existingPatient.imie} ${existingPatient.nazwisko})`);
          setDuplicatePeselDialog(true);
          return;
        }
      }
      
      const { data, error } = await supabase
            .from("pacjenci")
            .update({
              imie: formData.get("imie") as string,
              nazwisko: formData.get("nazwisko") as string,
              telefon: formData.get("telefon") as string,
              notatki: (formData.get("notatki") as string) || "",
              adres: (formData.get("adres") as string) || null,
              pesel: brakPesel ? null : pesel || null,
              brak_pesel: brakPesel,
              email: (formData.get("email") as string) || null,
            })
        .eq("id", currentPacjent.id)
        .select()
        .single();

      if (error) throw error;

      // Zaktualizuj rekord lokalnie bez przeładowania całej listy
      setPacjenci(prev => prev.map(p => p.id === currentPacjent.id ? data : p));
      setIsEditDialogOpen(false);
      setCurrentPacjent(null);
    } catch (err: any) {
      console.error("Error updating pacjent:", err);
      
      if (err.code === '23505' && err.message.includes('idx_pacjenci_pesel_unique')) {
        setDuplicatePeselMessage(`Pacjent o numerze PESEL ${pesel} już istnieje w bazie danych`);
        setDuplicatePeselDialog(true);
      } else {
        setError(`Błąd podczas aktualizacji pacjenta: ${err.message || err}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePacjent = (pacjent: Pacjent) => {
    setPacjentToDelete(pacjent);
    setDeleteDialogOpen(true);
  };

  const confirmDeletePacjent = async () => {
    if (!pacjentToDelete) return;
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from("pacjenci")
        .delete()
        .eq("id", pacjentToDelete.id);

      if (error) throw error;

      // Usuń lokalnie bez przeładowania listy
      setPacjenci(prev => prev.filter(p => p.id !== pacjentToDelete.id));
      setDeleteDialogOpen(false);
      setPacjentToDelete(null);
    } catch (err) {
      console.error("Error deleting pacjent:", err);
      setError("Błąd podczas usuwania pacjenta");
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (pacjent: Pacjent) => {
    setCurrentPacjent(pacjent);
    setIsEditDialogOpen(true);
  };

  // Handle prefilled name from appointment scheduling
  React.useEffect(() => {
    if (prefilledName && prefilledName.trim()) {
      const nameParts = prefilledName.trim().split(" ");
      const imie = nameParts[0] || "";
      const nazwisko = nameParts.slice(1).join(" ") || "";
      setInitialFormData({ imie, nazwisko });
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
                placeholder="Szukaj pacjenta (imię, nazwisko, telefon)..."
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
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="brakPesel" className="text-right">
                          Brak numeru PESEL
                        </Label>
                        <div className="col-span-3 flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="brakPesel"
                            name="brakPesel"
                            className="rounded"
                            onChange={(e) => {
                              const peselInput = document.getElementById('pesel') as HTMLInputElement;
                              if (peselInput) {
                                peselInput.disabled = e.target.checked;
                                if (e.target.checked) {
                                  peselInput.value = '';
                                }
                              }
                            }}
                          />
                          <Label htmlFor="brakPesel" className="text-sm">
                            Pacjent nie posiada numeru PESEL
                          </Label>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="pesel" className="text-right">
                          Numer PESEL
                        </Label>
                        <div className="col-span-3">
                          <Input
                            id="pesel"
                            name="pesel"
                            type="text"
                            maxLength={11}
                            className="font-mono"
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              e.target.value = value;
                              if (value.length === 11) {
                                const isValid = validatePESEL(value);
                                const extractedDate = extractDateFromPESEL(value);
                                if (isValid && extractedDate) {
                                  e.target.style.borderColor = '#10b981';
                                  e.target.title = `Prawidłowy PESEL. Data urodzenia: ${extractedDate.toLocaleDateString('pl-PL')}`;
                                } else {
                                  e.target.style.borderColor = '#ef4444';
                                  e.target.title = 'Nieprawidłowy numer PESEL';
                                }
                              } else {
                                e.target.style.borderColor = '';
                                e.target.title = '';
                              }
                            }}
                          />
                          <div className="text-xs text-gray-500 mt-1">
                            Wprowadź 11-cyfrowy numer PESEL
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="notatki" className="text-right">
                          Notatki
                        </Label>
                        <Input
                          id="notatki"
                          name="notatki"
                          className="col-span-3"
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
                {loading && pacjenci.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-muted-foreground"
                    >
                      Ładowanie pacjentów...
                    </TableCell>
                  </TableRow>
                ) : pacjenci.length > 0 ? (
                  <>
                    {pacjenci.map((pacjent) => (
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
                                handleDeletePacjent(pacjent);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Sentinel row — IntersectionObserver target */}
                    <TableRow ref={sentinelRef} className="h-1 border-0">
                      <TableCell colSpan={5} className="p-0">
                        {loadingMore && (
                          <div className="flex justify-center items-center py-4 gap-2 text-muted-foreground text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Ładowanie kolejnych pacjentów...
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-6 text-muted-foreground"
                    >
                      {debouncedSearch
                        ? `Nie znaleziono pacjentów dla frazy "${debouncedSearch}"`
                        : "Nie znaleziono pacjentów"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {!hasMore && pacjenci.length > 0 && (
            <p className="text-center text-sm text-muted-foreground mt-3">
              Wyświetlono wszystkich {pacjenci.length} pacjentów
            </p>
          )}
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
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-brakPesel" className="text-right">
                    Brak numeru PESEL
                  </Label>
                  <div className="col-span-3 flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit-brakPesel"
                      name="brakPesel"
                      className="rounded"
                      defaultChecked={currentPacjent?.brak_pesel || false}
                      onChange={(e) => {
                        const peselInput = document.getElementById('edit-pesel') as HTMLInputElement;
                        if (peselInput) {
                          peselInput.disabled = e.target.checked;
                          if (e.target.checked) {
                            peselInput.value = '';
                          }
                        }
                      }}
                    />
                    <Label htmlFor="edit-brakPesel" className="text-sm">
                      Pacjent nie posiada numeru PESEL
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-pesel" className="text-right">
                    Numer PESEL
                  </Label>
                  <div className="col-span-3">
                    <Input
                      id="edit-pesel"
                      name="pesel"
                      type="text"
                      maxLength={11}
                      className="font-mono"
                      defaultValue={currentPacjent?.pesel || ""}
                      disabled={currentPacjent?.brak_pesel || false}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        e.target.value = value;
                        if (value.length === 11) {
                          const isValid = validatePESEL(value);
                          const extractedDate = extractDateFromPESEL(value);
                          if (isValid && extractedDate) {
                            e.target.style.borderColor = '#10b981';
                            e.target.title = `Prawidłowy PESEL. Data urodzenia: ${extractedDate.toLocaleDateString('pl-PL')}`;
                          } else {
                            e.target.style.borderColor = '#ef4444';
                            e.target.title = 'Nieprawidłowy numer PESEL';
                          }
                        } else {
                          e.target.style.borderColor = '';
                          e.target.title = '';
                        }
                      }}
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Wprowadź 11-cyfrowy numer PESEL
                    </div>
                  </div>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć pacjenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć pacjenta {pacjentToDelete?.imie} {pacjentToDelete?.nazwisko}?
              <br />
              Ta akcja nie może zostać cofnięta. Wszystkie dane pacjenta, w tym historia wizyt, zostaną trwale usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePacjent} className="bg-red-600 hover:bg-red-700" disabled={loading}>
              {loading ? "Usuwanie..." : "Usuń"}
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
    </div>
  );
};

export default PacjenciPanel;
