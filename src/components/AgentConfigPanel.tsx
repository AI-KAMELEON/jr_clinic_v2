import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Phone,
  FileText,
  Settings,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const AgentConfigPanel = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    elevenlabs_agent_id: "",
    twilio_phone_number: "",
    agent_greeting: "Dzień dobry! Dzwonią Państwo do naszej kliniki. Jak mogę pomóc?",
  });
  const [promptMarkdown, setPromptMarkdown] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    loadConfig();
    loadPrompt();
  }, []);

  const loadConfig = async () => {
    try {
      // Wywołaj Edge Function do pobrania konfiguracji
      const { data, error } = await supabase.functions.invoke("agent-config", {
        method: "GET",
      });

      if (error) throw error;

      if (data?.config) {
        setConfig({
          elevenlabs_agent_id: data.config.elevenlabs_agent_id || "",
          twilio_phone_number: data.config.twilio_phone_number || "",
          agent_greeting: data.config.agent_greeting || "",
        });
      }
    } catch (error: any) {
      console.error("Error loading config:", error);
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się wczytać konfiguracji",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPrompt = async () => {
    try {
      const { data, error } = await supabase.storage
        .from("agent-config")
        .download("prompt.md");

      if (data && !error) {
        const text = await data.text();
        setPromptMarkdown(text);
      } else {
        // Załaduj domyślny prompt jeśli nie ma pliku
        setPromptMarkdown(getDefaultPrompt());
      }
    } catch (error) {
      console.error("Error loading prompt:", error);
      setPromptMarkdown(getDefaultPrompt());
    }
  };

  const getDefaultPrompt = () => {
    return `# Prompt dla Agenta Głosowego

## Tożsamość i Cel

Jesteś profesjonalnym asystentem w klinice stomatologicznej.

Dzisiejsza data: {{current_date}}
Aktualna godzina: {{current_time}}

## Twoje Zadania

1. **Przywitanie**: Przywitaj pacjenta uprzejmym tonem
2. **Identyfikacja**: Poproś o PESEL lub numer telefonu
3. **Umawianie wizyty**: Pokaż dostępne terminy i pomóż wybrać
4. **Potwierdzenie**: Zawsze potwierdź szczegóły przed zakończeniem

## Ważne Zasady

- Bądź uprzejmy i profesjonalny
- Zawsze używaj funkcji verify_patient przed umawianiem wizyty
- Nigdy nie rezerwuj wizyty bez potwierdzenia przez pacjenta
- Zawsze podaj pełne szczegóły: data, godzina, rodzaj wizyty
- Jeśli nie znasz odpowiedzi, grzecznie przeproś i przekieruj do recepcji

## Dostępne Funkcje

- \`verify_patient\` - Weryfikacja pacjenta po PESEL/telefonie
- \`get_available_slots\` - Pobieranie wolnych terminów
- \`book_appointment\` - Rezerwacja wizyty
- \`cancel_appointment\` - Anulowanie wizyty

## Przykładowe Zwroty

- "Dzień dobry! Dzwonią Państwo do naszej kliniki. Jak mogę pomóc?"
- "Czy mogę prosić o numer PESEL lub telefon do weryfikacji?"
- "Mam dla Państwa dostępne terminy: [lista terminów]"
- "Czy termin [data] o [godzina] będzie odpowiedni?"`;
  };

  const handleSavePrompt = async () => {
    setSaving(true);
    setStatus("idle");

    try {
      // Zapisz prompt jako plik .md do Storage
      const file = new Blob([promptMarkdown], { type: "text/markdown" });
      const { error } = await supabase.storage
        .from("agent-config")
        .upload("prompt.md", file, {
          upsert: true,
          contentType: "text/markdown",
        });

      if (error) throw error;

      setStatus("success");
      toast({
        title: "Sukces",
        description: "Prompt zapisany pomyślnie",
      });
    } catch (error: any) {
      setStatus("error");
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zapisać promptu",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    setStatus("idle");

    try {
      // Wywołaj Edge Function do zapisania konfiguracji
      const { data, error } = await supabase.functions.invoke("agent-config", {
        method: "POST",
        body: config,
      });

      if (error) throw error;

      setStatus("success");
      toast({
        title: "Sukces",
        description: "Konfiguracja zapisana pomyślnie",
      });
    } catch (error: any) {
      setStatus("error");
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się zapisać konfiguracji",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !config.elevenlabs_agent_id) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Nagłówek */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mic className="h-8 w-8" />
            Agent Głosowy
          </h1>
          <p className="text-muted-foreground mt-1">
            Konfiguracja głosowego asystenta dla umawiania wizyt
          </p>
        </div>
        {status === "success" && (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Zapisano
          </Badge>
        )}
      </div>

      {/* Informacja o statusie */}
      {status === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Wystąpił błąd podczas zapisywania. Sprawdź połączenie z bazą danych.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lewa kolumna - Konfiguracja podstawowa */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Konfiguracja Podstawowa
              </CardTitle>
              <CardDescription>
                Ustawienia agenta i integracji
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="agent-id">ElevenLabs Agent ID</Label>
                <Input
                  id="agent-id"
                  value={config.elevenlabs_agent_id}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      elevenlabs_agent_id: e.target.value,
                    })
                  }
                  placeholder="Wklej Agent ID z ElevenLabs"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  ID agenta utworzonego w panelu ElevenLabs
                </p>
              </div>

              <Separator />

              <div>
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Numer telefonu Twilio
                </Label>
                <Input
                  id="phone"
                  value={config.twilio_phone_number}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      twilio_phone_number: e.target.value,
                    })
                  }
                  placeholder="+48123456789"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Numer telefonu przypisany do agenta w Twilio
                </p>
              </div>

              <Separator />

              <div>
                <Label htmlFor="greeting">Powitanie (First Message)</Label>
                <Textarea
                  id="greeting"
                  value={config.agent_greeting}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      agent_greeting: e.target.value,
                    })
                  }
                  rows={2}
                  placeholder="Dzień dobry! Jak mogę pomóc?"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Pierwsza wiadomość, którą agent wypowie podczas połączenia
                </p>
              </div>

              <Button
                onClick={handleSaveConfig}
                disabled={loading || saving}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Zapisz Konfigurację
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Prawa kolumna - Prompt */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Prompt Agent (Markdown)
              </CardTitle>
              <CardDescription>
                Edytuj zachowanie agenta poprzez zmianę promptu
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Prompt w formacie Markdown</Label>
                <Textarea
                  value={promptMarkdown}
                  onChange={(e) => setPromptMarkdown(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="# Prompt dla Agenta..."
                />
                <div className="mt-2 p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium mb-1">Dostępne zmienne:</p>
                  <div className="flex flex-wrap gap-2">
                    <code className="text-xs bg-background px-2 py-1 rounded">
                      {`{{current_date}}`}
                    </code>
                    <code className="text-xs bg-background px-2 py-1 rounded">
                      {`{{current_time}}`}
                    </code>
                    <code className="text-xs bg-background px-2 py-1 rounded">
                      {`{{caller_number}}`}
                    </code>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSavePrompt}
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Zapisz Prompt
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sekcja informacyjna */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Jak to działa?</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>
              Wprowadź Agent ID z ElevenLabs (utworzony w panelu ElevenLabs)
            </li>
            <li>Ustaw numer telefonu Twilio przypisany do agenta</li>
            <li>Edytuj prompt aby dostosować zachowanie agenta</li>
            <li>
              Prompt jest wczytywany dynamicznie przy każdym połączeniu
            </li>
            <li>Zmiany w promptcie są natychmiast aktywne po zapisaniu</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

