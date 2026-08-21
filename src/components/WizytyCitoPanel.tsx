import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileText,
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
                  <TableRow key={wizyta.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-left hover:text-blue-600 hover:underline"
                        onClick={() => onPatientSelect?.(wizyta.pacjent_id)}
                      >
                        {wizyta.imie} {wizyta.nazwisko}
                      </button>
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
                    <TableCell>
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
                        {onPatientSelect && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onPatientSelect(wizyta.pacjent_id)}
                            title="Karta pacjenta"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WizytyCitoPanel;
