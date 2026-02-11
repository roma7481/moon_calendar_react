import { useCallback, useEffect, useMemo, useState } from 'react';
import { createNotesDbAdapter, createNotesRepository, NoteRecord } from './notesRepository';

export const useNotes = () => {
  const repo = useMemo(() => createNotesRepository(createNotesDbAdapter()), []);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const allNotes = await repo.getAllNotes();
      setNotes(allNotes);
      setError(null);
    } catch (err) {
      setError('Unable to load notes.');
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getNoteForMoonDay = useCallback(
    async (moonDayId: number) => {
      try {
        return await repo.getNoteByMoonDayIndex(moonDayId);
      } catch (err) {
        setError('Unable to load note.');
        return null;
      }
    },
    [repo]
  );

  const saveNote = useCallback(
    async (moonDayId: number, note: string, existingId?: number) => {
      try {
        if (existingId) {
          await repo.updateNote({ noteId: existingId, moonDayId, note });
        } else {
          await repo.addNote({ moonDayId, note });
        }
        await refresh();
      } catch (err) {
        setError('Unable to save note.');
      }
    },
    [refresh, repo]
  );

  const removeNote = useCallback(
    async (noteId: number) => {
      try {
        await repo.deleteNote(noteId);
        await refresh();
      } catch (err) {
        setError('Unable to delete note.');
      }
    },
    [refresh, repo]
  );

  return {
    notes,
    loading,
    error,
    refresh,
    refreshNotes: refresh,
    getAllNotes: repo.getAllNotes,
    getNoteForMoonDay,
    saveNote,
    removeNote,
  };
};
