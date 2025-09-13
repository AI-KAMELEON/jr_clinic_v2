import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Administrator {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export const AdminManagement: React.FC = () => {
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Formularz dodawania administratora
  const [newAdmin, setNewAdmin] = useState({
    email: '',
    name: '',
    password: ''
  });
  const [adding, setAdding] = useState(false);

  // Pobierz listę administratorów
  const fetchAdministrators = async () => {
    try {
      const { data, error } = await supabase
        .from('administrators')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdministrators(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdministrators();
  }, []);

  // Dodaj nowego administratora
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError('');
    setMessage('');

    try {
      // 1. Utwórz użytkownika w auth.users
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newAdmin.email,
        password: newAdmin.password,
        user_metadata: {
          full_name: newAdmin.name
        }
      });

      if (authError) throw authError;

      // 2. Dodaj do tabeli administratorów
      const { error: adminError } = await supabase
        .from('administrators')
        .insert({
          id: authData.user.id,
          email: newAdmin.email,
          name: newAdmin.name
        });

      if (adminError) throw adminError;

      setMessage('Administrator został dodany pomyślnie!');
      setNewAdmin({ email: '', name: '', password: '' });
      fetchAdministrators();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  // Usuń administratora
  const handleDeleteAdmin = async (id: string, email: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć administratora ${email}?`)) {
      return;
    }

    try {
      // 1. Usuń z tabeli administratorów
      const { error: adminError } = await supabase
        .from('administrators')
        .delete()
        .eq('id', id);

      if (adminError) throw adminError;

      // 2. Usuń użytkownika z auth.users
      const { error: authError } = await supabase.auth.admin.deleteUser(id);
      if (authError) throw authError;

      setMessage('Administrator został usunięty pomyślnie!');
      fetchAdministrators();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Zarządzanie administratorami</CardTitle>
          <CardDescription>
            Dodaj lub usuń administratorów systemu
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert className="mb-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {/* Formularz dodawania administratora */}
          <form onSubmit={handleAddAdmin} className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="name">Nazwa</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Imię Nazwisko"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Hasło</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Hasło"
                  value={newAdmin.password}
                  onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={adding}>
              {adding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Dodawanie...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Dodaj administratora
                </>
              )}
            </Button>
          </form>

          {/* Lista administratorów */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Lista administratorów</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nazwa</TableHead>
                  <TableHead>Data utworzenia</TableHead>
                  <TableHead>Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {administrators.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>{admin.name}</TableCell>
                    <TableCell>
                      {new Date(admin.created_at).toLocaleDateString('pl-PL')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
