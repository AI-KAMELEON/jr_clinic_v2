import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Funkcja sprawdzająca czy użytkownik jest administratorem
  const checkAdminStatus = async (user: User | null) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    // Tymczasowo ustaw jako administratora - naprawimy RLS później
    setIsAdmin(true);
    
    // TODO: Przywróć sprawdzanie uprawnień gdy RLS będzie działać
    /*
    try {
      const { data, error } = await supabase
        .from('administrators')
        .select('id')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        setIsAdmin(false);
        // Jeśli użytkownik nie jest administratorem, wyloguj go
        await supabase.auth.signOut();
      } else {
        setIsAdmin(true);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
    */
  };

  useEffect(() => {
    // Pobierz aktualną sesję
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      await checkAdminStatus(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    // Nasłuchuj zmian w stanie uwierzytelniania
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        await checkAdminStatus(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Wyczyść stan lokalny
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      
      // Wyloguj z Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in signOut:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    isAdmin,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
