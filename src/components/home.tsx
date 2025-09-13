import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, FileText, Plus } from "lucide-react";
import PacjenciPanel from "./PacjenciPanel";
import KalendarzWizyt from "./KalendarzWizyt";
import KartaPacjenta from "./KartaPacjenta";

const Home = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null,
  );
  const [prefilledPatientName, setPrefilledPatientName] = useState<string>("");

  // Przykładowe dane dla dashboardu
  const todayAppointments = [
    {
      id: "1",
      time: "09:00",
      patientName: "Anna Kowalska",
      type: "Przegląd",
      patientId: "2",
    },
    {
      id: "2",
      time: "10:30",
      patientName: "Jan Nowak",
      type: "Leczenie kanałowe",
      patientId: "1",
    },
    {
      id: "3",
      time: "12:00",
      patientName: "Maria Wiśniewska",
      type: "Wypełnienie",
      patientId: "3",
    },
    {
      id: "4",
      time: "14:30",
      patientName: "Piotr Zieliński",
      type: "Konsultacja",
      patientId: "5",
    },
  ];

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatientId(patientId);
    setActiveTab("karta-pacjenta");
  };

  // Handle navigation to add patient from appointment scheduling
  React.useEffect(() => {
    const handleNavigateToAddPatient = (event: CustomEvent) => {
      console.log("Navigation event received:", event.detail);
      const searchQuery = event.detail.searchQuery || "";
      
      if (searchQuery.trim()) {
        console.log("Navigating to patients panel with name:", searchQuery);
        
        // Switch to patients tab immediately
        setActiveTab("pacjenci");
        
        // Set the prefilled name with a small delay to ensure tab switch
        setTimeout(() => {
          setPrefilledPatientName(searchQuery.trim());
        }, 50);
      }
    };

    window.addEventListener(
      "navigateToAddPatient",
      handleNavigateToAddPatient as EventListener,
    );

    return () => {
      window.removeEventListener(
        "navigateToAddPatient",
        handleNavigateToAddPatient as EventListener,
      );
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nagłówek */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">
                DS
              </span>
            </div>
            <h1 className="text-xl font-bold">Klinika Stomatologiczna</h1>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              Pomoc
            </Button>
            <Button variant="ghost" size="sm">
              Ustawienia
            </Button>
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm font-medium">AD</span>
            </div>
          </div>
        </div>
      </header>

      {/* Główna zawartość */}
      <div className="flex flex-1">
        {/* Menu boczne */}
        <aside className="w-64 border-r bg-white p-4">
          <nav className="space-y-2">
            <Button
              variant={activeTab === "dashboard" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("dashboard")}
            >
              <Calendar className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <Button
              variant={activeTab === "pacjenci" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("pacjenci")}
            >
              <Users className="mr-2 h-4 w-4" />
              Pacjenci
            </Button>
            <Button
              variant={activeTab === "kalendarz" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("kalendarz")}
            >
              <Clock className="mr-2 h-4 w-4" />
              Kalendarz wizyt
            </Button>
            {selectedPatientId && (
              <Button
                variant={activeTab === "karta-pacjenta" ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setActiveTab("karta-pacjenta")}
              >
                <FileText className="mr-2 h-4 w-4" />
                Karta pacjenta
              </Button>
            )}
          </nav>
        </aside>

        {/* Obszar roboczy */}
        <main className="flex-1 p-6 overflow-auto">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsContent value="dashboard" className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-6">Panel główny</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Dzisiejsze wizyty</CardTitle>
                      <CardDescription>Zaplanowane na dziś</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {todayAppointments.length}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Pacjenci</CardTitle>
                      <CardDescription>Łączna liczba pacjentów</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">124</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Wizyty w tym tygodniu</CardTitle>
                      <CardDescription>Zaplanowane wizyty</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">28</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Dzisiejsze wizyty</CardTitle>
                  <CardDescription>
                    Lista wizyt zaplanowanych na dziś
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {todayAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="flex items-center justify-between border-b pb-2 cursor-pointer hover:bg-muted/50 rounded-md p-2 transition-colors"
                        onClick={() =>
                          handlePatientSelect(appointment.patientId)
                        }
                        title={`Przejdź do karty pacjenta: ${appointment.patientName}`}
                      >
                        <div className="flex items-center">
                          <div className="bg-primary/10 text-primary rounded-md p-2 mr-3">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {appointment.patientName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {appointment.type}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm font-medium">
                          {appointment.time}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Szybkie akcje</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      className="w-full justify-start"
                      onClick={() => setActiveTab("pacjenci")}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Dodaj nowego pacjenta
                    </Button>
                    <Button
                      className="w-full justify-start"
                      onClick={() => setActiveTab("kalendarz")}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Zaplanuj wizytę
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pacjenci">
              <PacjenciPanel
                onPatientSelect={handlePatientSelect}
                prefilledName={prefilledPatientName}
                onNameUsed={() => setPrefilledPatientName("")}
              />
            </TabsContent>

            <TabsContent value="kalendarz">
              <KalendarzWizyt />
            </TabsContent>

            <TabsContent value="karta-pacjenta">
              {selectedPatientId && <KartaPacjenta />}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Home;