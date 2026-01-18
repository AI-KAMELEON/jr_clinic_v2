// src/components/MessagesPage.tsx
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Download, Calendar, AlertTriangle, Send, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface SMSLog {
  log_id: string;
  created_at: string;
  typ: string;
  status: string;
  tresc: string;
  data_wizyty: string;
  godzina: string;
  imie: string;
  nazwisko: string;
  telefon: string;
  rodzaj: string;
}

const MessagesPage: React.FC = () => {
  const [messages, setMessages] = useState<SMSLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [filters, setFilters] = useState({
    date: '',
    type: 'ALL',
    status: 'ALL'
  });

  // Stan dla formularza wysyłania SMS
  const [smsForm, setSmsForm] = useState({
    date: '',
    type: 'PRZYPOMNIENIE',
    customText: ''
  });

  // Pobieranie wiadomości z filtrami
  const fetchMessages = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('sms_logs_view')
        .select('*')
        .order('created_at', { ascending: false });

      // Filtry
      if (filters.date) {
        query = query.eq('data_wizyty', filters.date);
      }
      if (filters.type !== 'ALL') {
        query = query.eq('typ', filters.type);
      }
      if (filters.status !== 'ALL') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Błąd pobierania wiadomości:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [filters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getStatusIcon = (status: string) => {
    return status === 'SENT' ? '✅' : '❌';
  };

  const getStatusColor = (status: string) => {
    return status === 'SENT' ? 'text-green-600' : 'text-red-600';
  };

  // Usuwanie pojedynczego logu
  const handleDeleteLog = async (logId: string, patientName: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć log SMS dla pacjenta ${patientName}?`)) {
      return;
    }

    setDeleting(logId);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('sms_logs')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      setSuccess('Log SMS został usunięty pomyślnie');
      await fetchMessages();
    } catch (err: any) {
      setError(`Błąd usuwania logu: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  // Eksport logów do CSV
  const handleExportLogs = () => {
    const csvContent = [
      ['Data wysłania', 'Pacjent', 'Telefon', 'Typ', 'Status', 'Treść'],
      ...messages.map(msg => [
        new Date(msg.created_at).toLocaleString('pl-PL'),
        `${msg.imie} ${msg.nazwisko}`,
        msg.telefon,
        msg.typ,
        msg.status,
        `"${msg.tresc.replace(/"/g, '""')}"` // Escape quotes in CSV
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sms_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Masowe usuwanie logów starszych niż 30 dni
  const handleBulkDeleteOld = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    if (!confirm(`Czy na pewno chcesz usunąć wszystkie logi SMS starsze niż ${dateStr}?`)) {
      return;
    }

    setDeleting('bulk');
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('sms_logs')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString());

      if (error) throw error;

      setSuccess('Stare logi SMS zostały usunięte pomyślnie');
      await fetchMessages();
    } catch (err: any) {
      setError(`Błąd usuwania starych logów: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  // Masowe usuwanie logów z błędami
  const handleBulkDeleteFailed = async () => {
    if (!confirm('Czy na pewno chcesz usunąć wszystkie logi SMS ze statusem FAILED?')) {
      return;
    }

    setDeleting('bulk-failed');
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase
        .from('sms_logs')
        .delete()
        .eq('status', 'FAILED');

      if (error) throw error;

      setSuccess('Logi SMS z błędami zostały usunięte pomyślnie');
      await fetchMessages();
    } catch (err: any) {
      setError(`Błąd usuwania logów z błędami: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  // Wysyłanie SMS przez Edge Function
  const handleSendSMS = async () => {
    if (!smsForm.date) {
      setError('Wybierz datę wizyt');
      return;
    }

    if (smsForm.type === 'INNE' && !smsForm.customText.trim()) {
      setError('Wprowadź treść wiadomości dla typu "Inne"');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      // 🔑 pobierz bieżącą sesję (access_token użytkownika)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Brak aktywnej sesji użytkownika – zaloguj się ponownie.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-admin-sms`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`, // ✅ prawdziwy token sesji
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date: smsForm.date,
            type: smsForm.type,
            customText: smsForm.type === 'INNE' ? smsForm.customText : undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      setSuccess(`SMS wysłane pomyślnie! Wysłano: ${result.sent}, Błędów: ${result.failed}`);
      
      // Wyczyść formularz
      setSmsForm({
        date: '',
        type: 'PRZYPOMNIENIE',
        customText: ''
      });
      
      // Odśwież listę wiadomości
      await fetchMessages();
    } catch (err: any) {
      setError(`Błąd wysyłania SMS: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Wiadomości SMS</h1>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportLogs}
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Eksport CSV</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkDeleteOld}
            disabled={deleting === 'bulk'}
            className="flex items-center space-x-2 text-orange-600 hover:text-orange-700"
          >
            <Calendar className="h-4 w-4" />
            <span>Usuń stare (30+ dni)</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkDeleteFailed}
            disabled={deleting === 'bulk-failed'}
            className="flex items-center space-x-2 text-red-600 hover:text-red-700"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Usuń błędy</span>
          </Button>
        </div>
      </div>

      {/* Alerty */}
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <AlertTriangle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Formularz wysyłania SMS */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <MessageSquare className="h-5 w-5 mr-2" />
          Wyślij SMS do pacjentów
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="sms-date">Data wizyt</Label>
            <Input
              id="sms-date"
              type="date"
              value={smsForm.date}
              onChange={(e) => setSmsForm(prev => ({ ...prev, date: e.target.value }))}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="sms-type">Typ wiadomości</Label>
            <Select
              value={smsForm.type}
              onValueChange={(value) => setSmsForm(prev => ({ ...prev, type: value, customText: '' }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRZYPOMNIENIE">Przypomnienie o wizycie</SelectItem>
                <SelectItem value="ODWOLANIE">Odwołanie wizyt</SelectItem>
                <SelectItem value="INNE">Wiadomość własna</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-end">
            <Button
              onClick={handleSendSMS}
              disabled={sending || !smsForm.date}
              className="w-full flex items-center space-x-2"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span>{sending ? 'Wysyłanie...' : 'Wyślij SMS'}</span>
            </Button>
          </div>
        </div>
        
        {smsForm.type === 'INNE' && (
          <div className="mt-4">
            <Label htmlFor="custom-text">Treść wiadomości</Label>
            <Textarea
              id="custom-text"
              value={smsForm.customText}
              onChange={(e) => setSmsForm(prev => ({ ...prev, customText: e.target.value }))}
              placeholder="Wprowadź treść wiadomości SMS..."
              className="mt-1"
              rows={3}
            />
            <p className="text-sm text-gray-500 mt-1">
              Wiadomość zostanie wysłana do wszystkich pacjentów umówionych na wybraną datę.
            </p>
          </div>
        )}
        
        {smsForm.type === 'ODWOLANIE' && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-sm text-orange-800">
              <strong>Uwaga:</strong> Ta wiadomość odwoła wszystkie wizyty na wybraną datę. 
              Pacjenci zostaną poproszeni o kontakt w celu ustalenia nowego terminu.
            </p>
          </div>
        )}
      </div>
      
      {/* Filtry */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data wizyty
            </label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Typ wiadomości
            </label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Wszystkie</option>
              <option value="PRZYPOMNIENIE">Przypomnienie</option>
              <option value="ODWOLANIE">Odwołanie</option>
              <option value="INNE">Inne</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Wszystkie</option>
              <option value="SENT">Wysłane</option>
              <option value="FAILED">Błąd</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Ładowanie wiadomości...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data wysłania
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pacjent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefon
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Typ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Treść
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcje
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {messages.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      Brak wiadomości do wyświetlenia
                    </td>
                  </tr>
                ) : (
                  messages.map((message) => (
                    <tr key={message.log_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(message.created_at).toLocaleString('pl-PL')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {message.imie} {message.nazwisko}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {message.telefon}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {message.typ}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="truncate" title={message.tresc}>
                          {message.tresc}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(message.status)}`}>
                          {getStatusIcon(message.status)} {message.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLog(message.log_id, `${message.imie} ${message.nazwisko}`)}
                          disabled={deleting === message.log_id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1"
                          title="Usuń log SMS"
                        >
                          {deleting === message.log_id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesPage;