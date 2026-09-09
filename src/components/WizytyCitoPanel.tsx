import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { supabase, type CitoStatus } from "@/lib/supabase";

export type WizytaCitoWithPacjent = {
  id: string;
  pacjent_id: string;
  kolejnosc: number;
  powod: string | null;
  notatki: string | null;
  status: string;
  created_at: string | null;
  imie: string;
  nazwisko: string;
  telefon: string;
};

interface WizytyCitoPanelProps {
  onPatientSelect?: (patientId: string) => void;
}

export const WizytyCitoPanel: React.FC<WizytyCitoPanelProps> = ({
  onPatientSelect,
}) => {
  const [wizyty, setWizyty] = useState<WizytaCitoWithPacjent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingWizyta, setEditingWizyta] = useState<WizytaCitoWithPacjent | null>(null);
  const [form, setForm] = useState({ powod: "", notatki: "" });
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [wizytaToDelete, setWizytaToDelete] = useState<string | null>(null);

  const fetchWizyty = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("wizyty_cito_pacjenci_view")
        .select("*")
        .eq("status", "oczekujaca")
        .order("kolejnosc", { ascending: true });

      if (fetchError) throw fetchError;

      setWizyty(
        (data || []).map((row) => ({
          id: row.id!,
          pacjent_id: row.pacjent_id!,
          kolejnosc: row.kolejnosc!,
          powod: row.powod,
          notatki: row.notatki,
          status: row.status!,
          created_at: row.created_at,
          imie: row.imie || "",
          nazwisko: row.nazwisko || "",
          telefon: row.telefon || "",
        })),
      );
    } catch (err) {
      console.error("Error fetching cito visits:", err);
      setError("Błąd podczas pobierania listy wizyt Cito");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWizyty();
  }, [fetchWizyty]);

  const updateStatus = async (id: string, status: CitoStatus) => {
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from("wizyty_cito")
        .update({ status })
        .eq("id", id);

      if (updateError) throw updateError;
      await fetchWizyty();
    } catch (err) {
      console.error("Error updating cito status:", err);
      setError("Błąd podczas aktualizacji statusu");
    }
  };

  const openEdit = (wizyta: WizytaCitoWithPacjent) => {
    setEditingWizyta(wizyta);
    setForm({
      powod: wizyta.powod || "",
      notatki: wizyta.notatki || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingWizyta) return;
    try {
      setSaving(true);
      setError(null);
      const { error: updateError } = await supabase
        .from("wizyty_cito")
        .update({
          powod: form.powod || null,
          notatki: form.notatki || null,
        })
        .eq("id", editingWizyta.id);

      if (updateError) throw updateError;
      setEditDialogOpen(false);
      setEditingWizyta(null);
      await fetchWizyty();
    } catch (err) {
      console.error("Error editing cito visit:", err);
      setError("Błąd podczas edycji wizyty Cito");
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (id: string) => {
    setWizytaToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!wizytaToDelete) return;
    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from("wizyty_cito")
        .delete()
        .eq("id", wizytaToDelete);

      if (deleteError) throw deleteError;
      setDeleteDialogOpen(false);
      setWizytaToDelete(null);
      await fetchWizyty();
    } catch (err) {
      console.error("Error deleting cito visit:", err);
      setError("Błąd podczas usuwania wizyty Cito");
    }
  };

  const moveItem = async (index: number, direction: "up" | "down") => {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= wizyty.length) return;

    const current = wizyty[index];
    const neighbor = wizyty[swapIndex];

    try {
      setReordering(true);
      setError(null);

      const { error: err1 } = await supabase
        .from("wizyty_cito")
        .update({ kolejnosc: neighbor.kolejnosc })
        .eq("id", current.id);

      if (err1) throw err1;

      const { error: err2 } = await supabase
        .from("wizyty_cito")
        .update({ kolejnosc: current.kolejnosc })
        .eq("id", neighbor.id);

      if (err2) throw err2;

      await fetchWizyty();
    } catch (err) {
      console.error("Error reordering cito visits:", err);
      setError("Błąd podczas zmiany kolejności");
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Wizyty Cito</h2>
        <Button variant="outline" size="sm" onClick={fetchWizyty} disabled={loading}>
          Odśwież
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Kolejka pilnych wizyt ({wizyty.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Ładowanie...</div>
          ) : wizyty.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground italic">
              Brak pacjentów na liście Cito
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Poz.</TableHead>
                  <TableHead>Pacjent</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Powód</TableHead>
                  <TableHead>Dodano</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wizyty.map((wizyta, index) => (
                  <TableRow
                    key={wizyta.id}
                    className={onPatientSelect ? "cursor-pointer hover:bg-muted/50" : undefined}
                    onClick={() => onPatientSelect?.(wizyta.pacjent_id)}
                    title={
                      onPatientSelect
                        ? `Kliknij aby przejść do karty pacjenta: ${wizyta.imie} ${wizyta.nazwisko}`
                        : undefined
                    }
                  >
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell className="font-medium">
                      {wizyta.imie} {wizyta.nazwisko}
                    </TableCell>
                    <TableCell>{wizyta.telefon}</TableCell>
                    <TableCell>{wizyta.powod || "—"}</TableCell>
                    <TableCell>
                      {wizyta.created_at
                        ? format(new Date(wizyta.created_at), "dd.MM.yyyy HH:mm", {
                            locale: pl,
                          })
                        : "—"}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={reordering || index === 0}
                          onClick={() => moveItem(index, "up")}
                          title="Przesuń w górę"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={reordering || index === wizyty.length - 1}
                          onClick={() => moveItem(index, "down")}
                          title="Przesuń w dół"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(wizyta)}
                          title="Edytuj"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => openDelete(wizyta.id)}
                          title="Usuń"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600"
                          onClick={() => updateStatus(wizyta.id, "zrealizowana")}
                          title="Oznacz jako zrealizowana"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600"
                          onClick={() => updateStatus(wizyta.id, "anulowana")}
                          title="Anuluj"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingWizyta(null);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edytuj wizytę Cito</DialogTitle>
            <DialogDescription>
              {editingWizyta
                ? `${editingWizyta.imie} ${editingWizyta.nazwisko}`
                : "Zaktualizuj powód lub notatki"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-cito-powod">Powód</Label>
              <Input
                id="edit-cito-powod"
                value={form.powod}
                onChange={(e) => setForm({ ...form, powod: e.target.value })}
                placeholder="np. ból zęba"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-cito-notatki">Notatki</Label>
              <Textarea
                id="edit-cito-notatki"
                value={form.notatki}
                onChange={(e) => setForm({ ...form, notatki: e.target.value })}
                placeholder="Dodatkowe uwagi..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingWizyta(null);
              }}
            >
              Anuluj
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć wizytę Cito?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja nie może zostać cofnięta. Wpis Cito zostanie trwale usunięty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WizytyCitoPanel;
