import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit2, Save, X, Trash2, AlertCircle, StickyNote } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/use-toast";

interface DailyNoteEditorProps {
  date: string; // Format: YYYY-MM-DD
  variant?: 'dashboard' | 'calendar';
  className?: string;
}

export const DailyNoteEditor: React.FC<DailyNoteEditorProps> = ({
  date,
  variant = 'dashboard',
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Get title based on variant
  const getTitle = () => {
    if (variant === 'dashboard') {
      return 'Notatka na dziś';
    }
    return 'Notatka';
  };

  // Fetch note for the given date
  const fetchNote = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('notatki_dzienne')
        .select('*')
        .eq('data', date)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setNoteId(data.id);
        setNoteContent(data.tresc);
        setOriginalContent(data.tresc);
      } else {
        setNoteId(null);
        setNoteContent('');
        setOriginalContent('');
        setIsEditing(true); // Start editing if no note exists
      }
    } catch (err) {
      console.error('Error fetching note:', err);
      setError('Błąd podczas pobierania notatki');
    } finally {
      setLoading(false);
    }
  };

  // Save or update note
  const handleSave = async () => {
    // Validate content
    if (!noteContent.trim()) {
      toast({
        title: "Błąd",
        description: "Notatka nie może być pusta",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { data, error } = await supabase
        .from('notatki_dzienne')
        .upsert({
          data: date,
          tresc: noteContent.trim(),
        }, {
          onConflict: 'data'
        })
        .select()
        .single();

      if (error) throw error;

      setNoteId(data.id);
      setOriginalContent(noteContent.trim());
      setIsEditing(false);

      toast({
        title: "Sukces",
        description: "Notatka została zapisana",
      });
    } catch (err) {
      console.error('Error saving note:', err);
      setError('Błąd podczas zapisywania notatki');
      toast({
        title: "Błąd",
        description: "Nie udało się zapisać notatki",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Open delete confirmation dialog
  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  // Confirm and delete note
  const confirmDelete = async () => {
    if (!noteId) return;

    try {
      setSaving(true);
      setError(null);
      setIsDeleteDialogOpen(false);

      const { error } = await supabase
        .from('notatki_dzienne')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      setNoteId(null);
      setNoteContent('');
      setOriginalContent('');
      setIsEditing(true);

      toast({
        title: "Sukces",
        description: "Notatka została usunięta",
      });
    } catch (err) {
      console.error('Error deleting note:', err);
      setError('Błąd podczas usuwania notatki');
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć notatki",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle edit button click
  const handleEdit = () => {
    setOriginalContent(noteContent);
    setIsEditing(true);
  };

  // Handle cancel button click
  const handleCancel = () => {
    setNoteContent(originalContent);
    setIsEditing(false);
    
    // If there was no note originally, keep editing mode
    if (!noteId) {
      setIsEditing(true);
    }
  };

  // Fetch note when date changes
  useEffect(() => {
    fetchNote();
  }, [date]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <StickyNote className="mr-2 h-5 w-5" />
            {getTitle()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Ładowanie...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className={variant === 'calendar' ? 'p-3' : ''}>
        <CardTitle className={`flex items-center ${variant === 'calendar' ? 'text-sm' : 'text-lg'}`}>
          <StickyNote className={`mr-2 ${variant === 'calendar' ? 'h-4 w-4' : 'h-5 w-5'}`} />
          {getTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent className={variant === 'calendar' ? 'p-3' : ''}>
        {error && (
          <Alert className="mb-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Wpisz notatkę..."
              className={`${variant === 'calendar' ? 'min-h-[60px] text-xs' : 'min-h-[120px]'} resize-none`}
              disabled={saving}
            />
            <div className={`flex justify-end ${variant === 'calendar' ? 'space-x-1' : 'space-x-2'}`}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={saving}
                className={variant === 'calendar' ? 'h-7 px-2 text-xs' : ''}
              >
                <X className={`mr-1 ${variant === 'calendar' ? 'h-3 w-3' : 'h-4 w-4'}`} />
                Anuluj
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !noteContent.trim()}
                className={variant === 'calendar' ? 'h-7 px-2 text-xs' : ''}
              >
                <Save className={`mr-1 ${variant === 'calendar' ? 'h-3 w-3' : 'h-4 w-4'}`} />
                {saving ? 'Zapisywanie...' : 'Zapisz'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {noteContent ? (
              <div className={`whitespace-pre-wrap bg-muted rounded-md ${variant === 'calendar' ? 'p-2 min-h-[60px] text-xs' : 'text-sm p-3 min-h-[120px]'}`}>
                {noteContent}
              </div>
            ) : (
              <div className={`text-center text-muted-foreground italic ${variant === 'calendar' ? 'py-4 text-xs' : 'py-8'}`}>
                Brak notatki na ten dzień
              </div>
            )}
            <div className={`flex justify-end ${variant === 'calendar' ? 'space-x-1' : 'space-x-2'}`}>
              {noteId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteClick}
                  disabled={saving}
                  className={`text-red-600 hover:text-red-700 ${variant === 'calendar' ? 'h-7 px-2 text-xs' : ''}`}
                >
                  <Trash2 className={`mr-1 ${variant === 'calendar' ? 'h-3 w-3' : 'h-4 w-4'}`} />
                  Usuń
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                disabled={saving}
                className={variant === 'calendar' ? 'h-7 px-2 text-xs' : ''}
              >
                <Edit2 className={`mr-1 ${variant === 'calendar' ? 'h-3 w-3' : 'h-4 w-4'}`} />
                {noteId ? 'Edytuj' : 'Dodaj notatkę'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć tę notatkę?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja jest nieodwracalna. Notatka zostanie trwale usunięta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default DailyNoteEditor;

