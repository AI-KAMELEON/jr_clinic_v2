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
import { Calendar, Clock, Users, FileText, Plus, LogOut, CheckCircle, X, Printer } from "lucide-react";
import PacjenciPanel from "./PacjenciPanel";
import KalendarzWizyt from "./KalendarzWizyt";
import KartaPacjenta from "./KartaPacjenta";
import { AdminManagement } from "./AdminManagement";
import MessagesPage from "./MessagesPage";
import DigitalClock from "./DigitalClock";
import { supabase, type VisitStatus } from "@/lib/supabase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Settings, MessageSquare } from "lucide-react";
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

  // Funkcje kolorów dla wizyt
  const getVisitBorderColor = (status: VisitStatus): string => {
    switch (status) {
      case 'wykonana':
        return 'border-l-green-500';
      case 'odwolana':
        return 'border-l-red-500';
      case 'zaplanowana':
      default:
        return 'border-l-blue-500';
    }
  };

  const getVisitBackgroundColor = (status: VisitStatus): string => {
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

  // Funkcja do aktualizacji statusu wizyty
  const handleUpdateVisitStatus = async (visitId: string, status: VisitStatus) => {
    try {
      const { error } = await supabase
        .from("wizyty")
        .update({ status })
        .eq("id", visitId);

      if (error) throw error;

      // Odśwież dane dashboardu
      await fetchDashboardData();
    } catch (err) {
      console.error("Error updating visit status:", err);
    }
  };

  // Funkcja do wydruku wizyt na dzisiaj
  const handlePrintTodayVisits = () => {
    const today = new Date();
    const todayStr = today.toLocaleDateString('pl-PL');
    
    // Przygotuj zawartość do wydruku
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Wizyty na dzień ${todayStr}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .clinic-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .date {
              font-size: 16px;
              color: #666;
            }
            .visit-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 10px 0;
              border-bottom: 1px solid #eee;
            }
            .visit-time {
              font-weight: bold;
              min-width: 60px;
            }
            .visit-patient {
              flex: 1;
              margin-left: 20px;
            }
            .visit-type {
              color: #666;
              font-size: 14px;
            }
            .visit-status {
              min-width: 100px;
              text-align: right;
              font-size: 12px;
              padding: 2px 8px;
              border-radius: 4px;
            }
            .status-zaplanowana {
              background-color: #e3f2fd;
              color: #1976d2;
            }
            .status-wykonana {
              background-color: #e8f5e8;
              color: #2e7d32;
            }
            .status-odwolana {
              background-color: #ffebee;
              color: #c62828;
            }
            .summary {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 2px solid #333;
              text-align: center;
              font-weight: bold;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="clinic-name">KARTOTEKA</div>
            <div class="date">WIZYTY NA DZIEŃ: ${todayStr}</div>
          </div>
          
          ${dashboardData.todayAppointments.length > 0 ? 
            dashboardData.todayAppointments.map(appointment => `
              <div class="visit-item">
                <div class="visit-time">${appointment.time}</div>
                <div class="visit-patient">
                  <div>${appointment.patientName}</div>
                  <div class="visit-type">${appointment.type}</div>
                </div>
                <div class="visit-status status-${appointment.status}">
                  ${appointment.status === 'zaplanowana' ? 'Zaplanowana' : 
                    appointment.status === 'wykonana' ? 'Wykonana' : 'Odwołana'}
                </div>
              </div>
            `).join('') : 
            '<div style="text-align: center; padding: 40px; color: #666;">Brak wizyt na dziś</div>'
          }
          
          <div class="summary">
            RAZEM: ${dashboardData.todayAppointments.length} wizyt
          </div>
        </body>
      </html>
    `;

    // Otwórz nowe okno z zawartością do wydruku
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Poczekaj na załadowanie i otwórz dialog drukowania
      printWindow.onload = () => {
        printWindow.print();
        printWindow.close();
      };
    }
  };

  // Funkcja do pobierania danych dashboardu
  const fetchDashboardData = async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true, error: null }));

      const today = new Date().toISOString().split('T')[0];
      
      // Tydzień kalendarzowy (poniedziałek - niedziela)
      const startOfWeek = new Date();
      const dayOfWeek = startOfWeek.getDay(); // 0 = niedziela, 1 = poniedziałek, etc.
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Liczba dni do poniedziałku
      startOfWeek.setDate(startOfWeek.getDate() + daysToMonday);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Niedziela
      
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
          status,
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
        status: visit.status || 'zaplanowana',
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
            <div className="w-12 h-10 flex items-center justify-center">
              <img 
                src="/logo_jr.jpeg" 
                alt="JR Logo" 
                className="w-12 h-10 rounded-lg"
                style={{ imageRendering: 'crisp-edges' }}
              />
            </div>
            <h1 className="text-xl font-bold">Klinika Stomatologiczna</h1>
          </div>
          
          {/* Zegar z datą pośrodku */}
          <DigitalClock />
          
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
            <Button
              variant={activeTab === "wiadomosci" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("wiadomosci")}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Wiadomości
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
            <Button
              variant={activeTab === "administratorzy" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("administratorzy")}
            >
              <Settings className="mr-2 h-4 w-4" />
              Administratorzy
            </Button>
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
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Dzisiejsze wizyty</CardTitle>
                      <CardDescription>
                        Lista wizyt zaplanowanych na dziś
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrintTodayVisits}
                      className="flex items-center space-x-2"
                      disabled={dashboardData.loading}
                    >
                      <Printer className="h-4 w-4" />
                      <span>Drukuj</span>
                    </Button>
                  </div>
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
                          className={`flex items-center justify-between border-l-4 ${getVisitBorderColor(appointment.status)} ${getVisitBackgroundColor(appointment.status)} rounded-md p-3 transition-colors`}
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
                          <div className="flex items-center space-x-2">
                            <div className="text-sm font-medium">
                              {appointment.time}
                            </div>
                            {appointment.status === 'zaplanowana' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateVisitStatus(appointment.id, 'wykonana');
                                  }}
                                  className="text-green-600 hover:text-green-700 p-1"
                                  title="Oznacz jako wykonaną"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateVisitStatus(appointment.id, 'odwolana');
                                  }}
                                  className="text-red-600 hover:text-red-700 p-1"
                                  title="Oznacz jako odwołaną"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePatientSelect(appointment.patientId);
                              }}
                              className="text-blue-600 hover:text-blue-700 p-1"
                              title="Przejdź do karty pacjenta"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
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
              <KalendarzWizyt 
                onNavigateToPatients={() => setActiveTab("pacjenci")} 
                onPatientSelect={handlePatientSelect}
              />
            </TabsContent>

            <TabsContent value="wiadomosci">
              <MessagesPage />
            </TabsContent>

            <TabsContent value="karta-pacjenta">
              {selectedPatientId && <KartaPacjenta pacjentId={selectedPatientId} />}
            </TabsContent>

            <TabsContent value="administratorzy">
              <AdminManagement />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Home;