import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase, type DodatkowaStatus } from "@/lib/supabase";

export type WizytaDodatkowaWithPacjent = {
  id: string;
  pacjent_id: string;
  data: string;
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
}

export const WizytyDodatkowePanel: React.FC<WizytyDodatkowePanelProps> = ({
  date,
  variant = "dashboard",
  className = "",
}) => {
  const [wizyty, setWizyty] = useState<WizytaDodatkowaWithPacjent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      setWizyty(
        (data || []).map((row) => ({
          id: row.id!,
          pacjent_id: row.pacjent_id!,
          data: row.data!,
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

  const isCompact = variant === "calendar";

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
            {wizyty.map((wizyta) => (
              <div
                key={wizyta.id}
                className={`flex items-start justify-between gap-2 rounded-md border p-2 ${
                  wizyta.status === "wykonana" ? "bg-green-50 border-green-200" : "bg-muted/40"
                }`}
              >
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
                <div className="flex shrink-0 gap-1">
                  {wizyta.status === "zaplanowana" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={isCompact ? "h-6 w-6" : "h-8 w-8"}
                        onClick={() => updateStatus(wizyta.id, "wykonana")}
                        title="Oznacz jako wykonana"
                      >
                        <CheckCircle2
                          className={`text-green-600 ${isCompact ? "h-3 w-3" : "h-4 w-4"}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={isCompact ? "h-6 w-6" : "h-8 w-8"}
                        onClick={() => updateStatus(wizyta.id, "anulowana")}
                        title="Anuluj"
                      >
                        <XCircle
                          className={`text-red-600 ${isCompact ? "h-3 w-3" : "h-4 w-4"}`}
                        />
                      </Button>
                    </>
                  )}
                  {wizyta.status === "wykonana" && (
                    <span className="text-green-600 text-xs font-medium px-1">Wykonana</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WizytyDodatkowePanel;
