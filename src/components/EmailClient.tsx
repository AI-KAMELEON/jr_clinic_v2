import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Mail,
  Send,
  Plus,
  Settings,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Inbox,
  Archive,
} from "lucide-react";

interface EmailAccount {
  id: string;
  email_address: string;
  provider: "gmail" | "outlook" | "custom_smtp";
  auth_type: "oauth2" | "smtp";
  is_active: boolean;
  display_name?: string;
}

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  status: "sent" | "failed" | "pending";
  sent_at: string;
  created_at: string;
  pacjent_id?: string;
}

interface InboxEmail {
  id: string;
  from_email: string;
  from_name?: string;
  subject: string;
  body_preview: string;
  received_at: string;
  is_read: boolean;
}

const EmailClient: React.FC = () => {
  const { toast } = useToast();
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState("accounts");
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [inboxEmails, setInboxEmails] = useState<InboxEmail[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog states
  const [addAccountDialogOpen, setAddAccountDialogOpen] = useState(false);
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [composeForm, setComposeForm] = useState({
    email_account_id: "",
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body_text: "",
    body_html: "",
  });

  // Add account form
  const [accountForm, setAccountForm] = useState({
    provider: "custom_smtp" as "gmail" | "outlook" | "custom_smtp",
    auth_type: "smtp" as "oauth2" | "smtp",
    email_address: "",
    smtp_host: "",
    smtp_port: "587",
    smtp_secure: false,
    smtp_username: "",
    smtp_password: "",
    display_name: "",
  });

  useEffect(() => {
    loadAccounts();
    loadEmailLogs();
  }, []);

  const loadAccounts = async () => {
    try {
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-config`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Failed to load accounts");

      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error: any) {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się załadować kont email",
        variant: "destructive",
      });
    }
  };

  const loadEmailLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setEmailLogs(data || []);
    } catch (error: any) {
      console.error("Error loading email logs:", error);
    }
  };

  const loadInbox = async (accountId: string) => {
    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-emails?email_account_id=${accountId}&maxResults=50`
      );

      if (!response.ok) throw new Error("Failed to fetch emails");

      const data = await response.json();
      
      // Load from database
      const { data: inboxData, error } = await supabase
        .from("email_inbox")
        .select("*")
        .eq("email_account_id", accountId)
        .eq("is_archived", false)
        .order("received_at", { ascending: false })
        .limit(50);

      if (!error && inboxData) {
        setInboxEmails(
          inboxData.map((email) => ({
            id: email.id,
            from_email: email.from_email,
            from_name: email.from_name || "",
            subject: email.subject || "",
            body_preview: email.body_text?.substring(0, 100) || "",
            received_at: email.received_at,
            is_read: email.is_read,
          }))
        );
      }
    } catch (error: any) {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się pobrać emaili",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async () => {
    try {
      if (!session) return;

      setLoading(true);

      const accountData: any = {
        provider: accountForm.provider,
        auth_type: accountForm.auth_type,
        email_address: accountForm.email_address,
        display_name: accountForm.display_name || accountForm.email_address,
      };

      if (accountForm.auth_type === "smtp") {
        accountData.smtp_host = accountForm.smtp_host;
        accountData.smtp_port = parseInt(accountForm.smtp_port);
        accountData.smtp_secure = accountForm.smtp_secure;
        accountData.smtp_username = accountForm.smtp_username;
        accountData.smtp_password = accountForm.smtp_password;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-config`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(accountData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to add account");
      }

      toast({
        title: "Sukces",
        description: "Konto email zostało dodane",
      });

      setAddAccountDialogOpen(false);
      setAccountForm({
        provider: "custom_smtp",
        auth_type: "smtp",
        email_address: "",
        smtp_host: "",
        smtp_port: "587",
        smtp_secure: false,
        smtp_username: "",
        smtp_password: "",
        display_name: "",
      });
      await loadAccounts();
    } catch (error: any) {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się dodać konta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to konto?")) return;

    try {
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-config?id=${accountId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to delete account");

      toast({
        title: "Sukces",
        description: "Konto zostało usunięte",
      });

      await loadAccounts();
    } catch (error: any) {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się usunąć konta",
        variant: "destructive",
      });
    }
  };

  const handleSendEmail = async () => {
    try {
      if (!composeForm.email_account_id || !composeForm.to || !composeForm.subject || !composeForm.body_text) {
        toast({
          title: "Błąd",
          description: "Wypełnij wszystkie wymagane pola",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email_account_id: composeForm.email_account_id,
            to: composeForm.to,
            cc: composeForm.cc ? composeForm.cc.split(",").map((e) => e.trim()) : undefined,
            bcc: composeForm.bcc ? composeForm.bcc.split(",").map((e) => e.trim()) : undefined,
            subject: composeForm.subject,
            body_text: composeForm.body_text,
            body_html: composeForm.body_html || composeForm.body_text,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to send email");
      }

      toast({
        title: "Sukces",
        description: "Email został wysłany",
      });

      setComposeDialogOpen(false);
      setComposeForm({
        email_account_id: "",
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body_text: "",
        body_html: "",
      });
      await loadEmailLogs();
    } catch (error: any) {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się wysłać emaila",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Wysłany</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Błąd</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Oczekujący</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Klient Email</h1>
        <div className="flex gap-2">
          <Button onClick={() => setComposeDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nowa wiadomość
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="accounts">
            <Settings className="h-4 w-4 mr-2" />
            Konta
          </TabsTrigger>
          <TabsTrigger value="inbox">
            <Inbox className="h-4 w-4 mr-2" />
            Odebrane
          </TabsTrigger>
          <TabsTrigger value="sent">
            <Send className="h-4 w-4 mr-2" />
            Wysłane
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Konta Email</CardTitle>
                  <CardDescription>Zarządzaj kontami email</CardDescription>
                </div>
                <Button onClick={() => setAddAccountDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj konto
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Brak kont email. Dodaj pierwsze konto.
                </div>
              ) : (
                <div className="space-y-4">
                  {accounts.map((account) => (
                    <Card key={account.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-semibold">{account.display_name || account.email_address}</div>
                            <div className="text-sm text-gray-500">{account.email_address}</div>
                            <div className="flex gap-2 mt-2">
                              <Badge>{account.provider}</Badge>
                              <Badge variant="outline">{account.auth_type}</Badge>
                              {account.is_active && <Badge className="bg-green-500">Aktywne</Badge>}
                            </div>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteAccount(account.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbox" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Skrzynka odbiorcza</CardTitle>
                  <CardDescription>Otrzymane wiadomości email</CardDescription>
                </div>
                {accounts.length > 0 && (
                  <Select
                    onValueChange={(value) => loadInbox(value)}
                  >
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Wybierz konto" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.display_name || account.email_address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {inboxEmails.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {loading ? "Ładowanie..." : "Brak emaili w skrzynce odbiorczej"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Od</TableHead>
                      <TableHead>Temat</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inboxEmails.map((email) => (
                      <TableRow key={email.id} className={!email.is_read ? "font-semibold" : ""}>
                        <TableCell>{email.from_name || email.from_email}</TableCell>
                        <TableCell>{email.subject}</TableCell>
                        <TableCell>{new Date(email.received_at).toLocaleString("pl-PL")}</TableCell>
                        <TableCell>
                          {email.is_read ? (
                            <Badge variant="outline">Przeczytane</Badge>
                          ) : (
                            <Badge>Nowe</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Wysłane wiadomości</CardTitle>
                  <CardDescription>Historia wysłanych emaili</CardDescription>
                </div>
                <Button variant="outline" onClick={loadEmailLogs}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Odśwież
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {emailLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Brak wysłanych emaili
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Do</TableHead>
                      <TableHead>Temat</TableHead>
                      <TableHead>Data wysłania</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{log.to}</TableCell>
                        <TableCell>{log.subject}</TableCell>
                        <TableCell>
                          {log.sent_at
                            ? new Date(log.sent_at).toLocaleString("pl-PL")
                            : new Date(log.created_at).toLocaleString("pl-PL")}
                        </TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Account Dialog */}
      <Dialog open={addAccountDialogOpen} onOpenChange={setAddAccountDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dodaj konto email</DialogTitle>
            <DialogDescription>
              Skonfiguruj nowe konto email (SMTP lub OAuth2)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Dostawca</Label>
              <Select
                value={accountForm.provider}
                onValueChange={(value: any) =>
                  setAccountForm({ ...accountForm, provider: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom_smtp">Własny SMTP</SelectItem>
                  <SelectItem value="gmail">Gmail (OAuth2)</SelectItem>
                  <SelectItem value="outlook">Outlook (OAuth2)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Typ autoryzacji</Label>
              <Select
                value={accountForm.auth_type}
                onValueChange={(value: any) =>
                  setAccountForm({ ...accountForm, auth_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smtp">SMTP (hasło)</SelectItem>
                  <SelectItem value="oauth2">OAuth2 (Google/Microsoft)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Adres email *</Label>
              <Input
                value={accountForm.email_address}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, email_address: e.target.value })
                }
                placeholder="twoj@email.com"
                type="email"
              />
            </div>

            <div className="space-y-2">
              <Label>Nazwa wyświetlana</Label>
              <Input
                value={accountForm.display_name}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, display_name: e.target.value })
                }
                placeholder="Nazwa nadawcy"
              />
            </div>

            {accountForm.auth_type === "smtp" && (
              <>
                <div className="space-y-2">
                  <Label>Host SMTP *</Label>
                  <Input
                    value={accountForm.smtp_host}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, smtp_host: e.target.value })
                    }
                    placeholder="smtp.gmail.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Port SMTP *</Label>
                  <Input
                    value={accountForm.smtp_port}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, smtp_port: e.target.value })
                    }
                    placeholder="587"
                    type="number"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Użytkownik SMTP *</Label>
                  <Input
                    value={accountForm.smtp_username}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, smtp_username: e.target.value })
                    }
                    placeholder="twoj@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Hasło SMTP *</Label>
                  <Input
                    value={accountForm.smtp_password}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, smtp_password: e.target.value })
                    }
                    type="password"
                    placeholder="Hasło do konta email"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="smtp_secure"
                    checked={accountForm.smtp_secure}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, smtp_secure: e.target.checked })
                    }
                    className="rounded"
                  />
                  <Label htmlFor="smtp_secure">Użyj SSL/TLS (port 465)</Label>
                </div>
              </>
            )}

            {accountForm.auth_type === "oauth2" && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800">
                  OAuth2 dla Gmail i Outlook będzie dostępne w przyszłej wersji.
                  Na razie użyj SMTP z hasłem aplikacji.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAccountDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleAddAccount} disabled={loading}>
              {loading ? "Dodawanie..." : "Dodaj konto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose Email Dialog */}
      <Dialog open={composeDialogOpen} onOpenChange={setComposeDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nowa wiadomość</DialogTitle>
            <DialogDescription>Napisz i wyślij email</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Z konta *</Label>
              <Select
                value={composeForm.email_account_id}
                onValueChange={(value) =>
                  setComposeForm({ ...composeForm, email_account_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz konto" />
                </SelectTrigger>
                <SelectContent>
                  {accounts
                    .filter((a) => a.is_active)
                    .map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.display_name || account.email_address}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Do *</Label>
              <Input
                value={composeForm.to}
                onChange={(e) =>
                  setComposeForm({ ...composeForm, to: e.target.value })
                }
                placeholder="odbiorca@email.com"
                type="email"
              />
            </div>

            <div className="space-y-2">
              <Label>CC (oddzielone przecinkami)</Label>
              <Input
                value={composeForm.cc}
                onChange={(e) =>
                  setComposeForm({ ...composeForm, cc: e.target.value })
                }
                placeholder="cc1@email.com, cc2@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label>BCC (oddzielone przecinkami)</Label>
              <Input
                value={composeForm.bcc}
                onChange={(e) =>
                  setComposeForm({ ...composeForm, bcc: e.target.value })
                }
                placeholder="bcc1@email.com, bcc2@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Temat *</Label>
              <Input
                value={composeForm.subject}
                onChange={(e) =>
                  setComposeForm({ ...composeForm, subject: e.target.value })
                }
                placeholder="Temat wiadomości"
              />
            </div>

            <div className="space-y-2">
              <Label>Treść *</Label>
              <Textarea
                value={composeForm.body_text}
                onChange={(e) =>
                  setComposeForm({ ...composeForm, body_text: e.target.value })
                }
                placeholder="Treść wiadomości email..."
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSendEmail} disabled={loading}>
              {loading ? "Wysyłanie..." : "Wyślij"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailClient;





