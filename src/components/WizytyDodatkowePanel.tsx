import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Clock, Pencil, Trash2, XCircle } from "lucide-react";
import { supabase, type DodatkowaStatus } from "@/lib/supabase";

export type WizytaDodatkowaWithPacjent = {
  id: string;
  pacjent_id: string;
  data: string;
  kolejnosc: number;
  rodzaj: string;
  notatki: string | null;
  status: string;
  created_at: string | null;
  imie: string;
  nazwisko: string;
  telefon: string;
};

interface WizytyDodatkowePanelProps {
  date: string;
  variant?: "dashboard" | "calendar";
  className?: string;
  onPatientSelect?: (patientId: string) => void;
}

export const WizytyDodatkowePanel: React.FC<WizytyDodatkowePanelProps> = ({
  date,
  variant = "dashboard",
  className = "",
  onPatientSelect,
}) => {
  const [wizyty, setWizyty] = useState<WizytaDodatkowaWithPacjent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingWizyta, setEditingWizyta] = useState<WizytaDodatkowaWithPacjent | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [wizytaToDelete, setWizytaToDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ data: "", rodzaj: "", notatki: "" });
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  const getTitle = () =>
    variant === "dashboard" ? "Wizyty dodatkowe na dziś" : "Wizyty dodatkowe";

  const fetchWizyty = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("wizyty_dodatkowe_pacjenci_view")
        .select("*")
        .eq("data", date)
        .neq("status", "anulowana")
        .order("kolejnosc", { ascending: true });

      if (fetchError) throw fetchError;

      setWizyty(
        (data || []).map((row) => ({
          id: row.id!,
          pacjent_id: row.pacjent_id!,
          data: row.data!,
          kolejnosc: row.kolejnosc ?? 0,
          rodzaj: row.rodzaj!,
          notatki: row.notatki,
          status: row.status!,
          created_at: row.created_at,
          imie: row.imie || "",
          nazwisko: row.nazwisko || "",
          telefon: row.telefon || "",
        })),
      );
    } catch (err) {
      console.error("Error fetching additional visits:", err);
      setError("Błąd podczas pobierania wizyt dodatkowych");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchWizyty();
  }, [fetchWizyty]);

  const updateStatus = async (id: string, status: DodatkowaStatus) => {
    try {
      setError(null);
      const { error: updateError } = await supabase
        .from("wizyty_dodatkowe")
        .update({ status })
        .eq("id", id);

      if (updateError) throw updateError;
      await fetchWizyty();
    } catch (err) {
      console.error("Error updating additional visit status:", err);
      setError("Błąd podczas aktualizacji statusu");
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
        .from("wizyty_dodatkowe")
        .update({ kolejnosc: neighbor.kolejnosc })
        .eq("id", current.id);

      if (err1) throw err1;

      const { error: err2 } = await supabase
        .from("wizyty_dodatkowe")
        .update({ kolejnosc: current.kolejnosc })
        .eq("id", neighbor.id);

      if (err2) throw err2;

      await fetchWizyty();
    } catch (err) {
      console.error("Error reordering additional visits:", err);
      setError("Błąd podczas zmiany kolejności");
    } finally {
      setReordering(false);
    }
  };

  const openEdit = (wizyta: WizytaDodatkowaWithPacjent) => {
    setEditingWizyta(wizyta);
    setForm({
      data: wizyta.data,
      rodzaj: wizyta.rodzaj,
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
        .from("wizyty_dodatkowe")
        .update({
          data: form.data,
          rodzaj: form.rodzaj,
          notatki: form.notatki || null,
        })
        .eq("id", editingWizyta.id);

      if (updateError) throw updateError;
      setEditDialogOpen(false);
      setEditingWizyta(null);
      await fetchWizyty();
    } catch (err) {
      console.error("Error editing additional visit:", err);
      setError("Błąd podczas edycji wizyty dodatkowej");
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
        .from("wizyty_dodatkowe")
        .delete()
        .eq("id", wizytaToDelete);

      if (deleteError) throw deleteError;
      setDeleteDialogOpen(false);
      setWizytaToDelete(null);
      await fetchWizyty();
    } catch (err) {
      console.error("Error deleting additional visit:", err);
      setError("Błąd podczas usuwania wizyty dodatkowej");
    }
  };

  const isCompact = variant === "calendar";
  const useSingleLine = variant === "dashboard" || variant === "calendar";
  const actionBtnClass = useSingleLine ? "h-7 w-7" : isCompact ? "h-6 w-6" : "h-8 w-8";
  const actionIconClass = useSingleLine ? "h-3.5 w-3.5" : isCompact ? "h-3 w-3" : "h-4 w-4";

  const renderActions = (wizyta: WizytaDodatkowaWithPacjent, index: number) => (
    <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon"
        className={actionBtnClass}
        disabled={reordering || index === 0}
        onClick={() => moveItem(index, "up")}
        title="Przesuń w górę"
      >
        <ArrowUp className={actionIconClass} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={actionBtnClass}
        disabled={reordering || index === wizyty.length - 1}
        onClick={() => moveItem(index, "down")}
        title="Przesuń w dół"
      >
        <ArrowDown className={actionIconClass} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={actionBtnClass}
        onClick={() => openEdit(wizyta)}
        title="Edytuj"
      >
        <Pencil className={actionIconClass} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={actionBtnClass}
        onClick={() => openDelete(wizyta.id)}
        title="Usuń"
      >
        <Trash2 className={`${actionIconClass} text-red-500`} />
      </Button>
      {wizyta.status === "zaplanowana" && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className={actionBtnClass}
            onClick={() => updateStatus(wizyta.id, "wykonana")}
            title="Oznacz jako wykonana"
          >
            <CheckCircle2 className={`${actionIconClass} text-green-600`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={actionBtnClass}
            onClick={() => updateStatus(wizyta.id, "anulowana")}
            title="Anuluj"
          >
            <XCircle className={`${actionIconClass} text-red-600`} />
          </Button>
        </>
      )}
      {wizyta.status === "wykonana" && (
        <span className="px-1 text-xs font-medium text-green-600">Wykonana</span>
      )}
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader className={isCompact ? "p-3" : ""}>
        <CardTitle
          className={`flex items-center ${isCompact ? "text-sm" : "text-lg"}`}
        >
          <Clock className={`mr-2 ${isCompact ? "h-4 w-4" : "h-5 w-5"}`} />
          {getTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent className={isCompact ? "p-3" : ""}>
        {error && (
          <Alert className="mb-3" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div
            className={`text-center text-muted-foreground ${isCompact ? "py-3 text-xs" : "py-6"}`}
          >
            Ładowanie...
          </div>
        ) : wizyty.length === 0 ? (
          <div
            className={`text-center text-muted-foreground italic ${isCompact ? "py-3 text-xs" : "py-6"}`}
          >
            Brak wizyt dodatkowych na ten dzień
          </div>
        ) : (
          <div className={`space-y-2 ${isCompact ? "text-xs" : "text-sm"}`}>
            {wizyty.map((wizyta, index) => (
              <div
                key={wizyta.id}
                className={`flex items-center justify-between gap-2 rounded-md border p-2 ${
                  wizyta.status === "wykonana" ? "bg-green-50 border-green-200" : "bg-muted/40"
                } ${useSingleLine ? "text-xs" : ""} ${
                  onPatientSelect ? "cursor-pointer hover:bg-muted/70 transition-colors" : ""
                }`}
                onClick={() => onPatientSelect?.(wizyta.pacjent_id)}
                title={
                  onPatientSelect
                    ? `Kliknij aby przejść do karty pacjenta: ${wizyta.imie} ${wizyta.nazwisko}`
                    : undefined
                }
              >
                {useSingleLine ? (
                  <>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="w-[8rem] shrink-0 truncate font-medium">
                        {wizyta.imie} {wizyta.nazwisko}
                      </span>
                      <span
                        className="w-[10rem] shrink-0 truncate text-muted-foreground"
                        title={wizyta.rodzaj}
                      >
                        {wizyta.rodzaj}
                      </span>
                      <span
                        className="w-[14rem] shrink-0 truncate italic text-muted-foreground"
                        title={wizyta.notatki || undefined}
                      >
                        {wizyta.notatki || "—"}
                      </span>
                    </div>
                    {renderActions(wizyta, index)}
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {wizyta.imie} {wizyta.nazwisko}
                      </div>
                      <div className="text-muted-foreground">{wizyta.rodzaj}</div>
                      {wizyta.notatki && (
                        <div className="text-muted-foreground mt-1 italic truncate">
                          {wizyta.notatki}
                        </div>
                      )}
                    </div>
                    {renderActions(wizyta, index)}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingWizyta(null);
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edytuj wizytę dodatkową</DialogTitle>
            <DialogDescription>
              {editingWizyta
                ? `${editingWizyta.imie} ${editingWizyta.nazwisko}`
                : "Zaktualizuj dane wizyty"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-dod-data">Data</Label>
              <Input
                id="edit-dod-data"
                type="date"
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dod-rodzaj">Rodzaj</Label>
              <Input
                id="edit-dod-rodzaj"
                value={form.rodzaj}
                onChange={(e) => setForm({ ...form, rodzaj: e.target.value })}
                placeholder="np. zdjęcie gumek"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dod-notatki">Notatki</Label>
              <Textarea
                id="edit-dod-notatki"
                value={form.notatki}
                onChange={(e) => setForm({ ...form, notatki: e.target.value })}
                placeholder="Opcjonalne uwagi..."
                rows={2}
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
            <AlertDialogTitle>Usunąć wizytę dodatkową?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja nie może zostać cofnięta. Wizyta dodatkowa zostanie trwale usunięta.
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
    </Card>
  );
};

export default WizytyDodatkowePanel;
