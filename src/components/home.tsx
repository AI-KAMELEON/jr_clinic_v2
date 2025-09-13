import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, FileText, Plus, LogOut } from "lucide-react";
import PacjenciPanel from "./PacjenciPanel";
import KalendarzWizyt from "./KalendarzWizyt";
import KartaPacjenta from "./KartaPacjenta";
import { supabase } from "@/lib/supabase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Home = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null,
  );
  const [prefilledPatientName, setPrefilledPatientName] = useState<string>("");

  // Stan dla danych dashboardu
  const [dashboardData, setDashboardData] = useState({
    todayAppointments: [],
    totalPatients: 0,
    weeklyAppointments: 0,
    loading: true,
    error: null,
  });

  // Funkcja do pobierania danych dashboardu
  const fetchDashboardData = async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true, error: null }));

      const today = new Date().toISOString().split('T')[0];
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const endOfWeek = new Date();
      endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
      
      const startOfWeekStr = startOfWeek.toISOString().split('T')[0];
      const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

      // Pobierz dzisiejsze wizyty z danymi pacjentów
      const { data: todayVisits, error: todayError } = await supabase
        .from("wizyty")
        .select(`
          id,
          data,
          godzina,
          rodzaj,
          pacjenci!inner(imie, nazwisko, id)
        `)
        .eq("data", today)
        .order("godzina");

      if (todayError) throw todayError;

      // Pobierz liczbę pacjentów
      const { count: totalPatients, error: patientsError } = await supabase
        .from("pacjenci")
        .select("*", { count: "exact", head: true });

      if (patientsError) throw patientsError;

      // Pobierz wizyty w tym tygodniu
      const { count: weeklyAppointments, error: weeklyError } = await supabase
        .from("wizyty")
        .select("*", { count: "exact", head: true })
        .gte("data", startOfWeekStr)
        .lte("data", endOfWeekStr);

      if (weeklyError) throw weeklyError;

      // Przekształć dane wizyt
      const formattedTodayAppointments = todayVisits?.map(visit => ({
        id: visit.id,
        time: visit.godzina.substring(0, 5),
        patientName: `${visit.pacjenci.imie} ${visit.pacjenci.nazwisko}`,
        type: visit.rodzaj,
        patientId: visit.pacjenci.id,
      })) || [];

      setDashboardData({
        todayAppointments: formattedTodayAppointments,
        totalPatients: totalPatients || 0,
        weeklyAppointments: weeklyAppointments || 0,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setDashboardData(prev => ({
        ...prev,
        loading: false,
        error: "Błąd podczas pobierania danych dashboardu",
      }));
    }
  };

  // Pobierz dane przy załadowaniu komponentu
  useEffect(() => {
    fetchDashboardData();
  }, []);

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
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {user?.email}
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={signOut}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Wyloguj
              </Button>
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
                
                {dashboardData.error && (
                  <Alert className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{dashboardData.error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Dzisiejsze wizyty</CardTitle>
                      <CardDescription>Zaplanowane na dziś</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {dashboardData.loading ? "..." : dashboardData.todayAppointments.length}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Pacjenci</CardTitle>
                      <CardDescription>Łączna liczba pacjentów</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {dashboardData.loading ? "..." : dashboardData.totalPatients}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Wizyty w tym tygodniu</CardTitle>
                      <CardDescription>Zaplanowane wizyty</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {dashboardData.loading ? "..." : dashboardData.weeklyAppointments}
                      </div>
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
                  {dashboardData.loading ? (
                    <div className="text-center py-6 text-muted-foreground">
                      Ładowanie wizyt...
                    </div>
                  ) : dashboardData.todayAppointments.length > 0 ? (
                    <div className="space-y-4">
                      {dashboardData.todayAppointments.map((appointment) => (
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
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      Brak wizyt na dziś
                    </div>
                  )}
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
              <KalendarzWizyt onNavigateToPatients={() => setActiveTab("pacjenci")} />
            </TabsContent>

            <TabsContent value="karta-pacjenta">
              {selectedPatientId && selectedPatient && <KartaPacjenta pacjent={selectedPatient} />}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Home;