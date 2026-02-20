import { initNotesDb, executeNotesSql, NOTES_TABLE, migrateLegacyNotesIfPresent } from './notesDb';
import { makeMoonDayKey, parseMoonDayId } from './notesMapping';
import * as FileSystem from 'expo-file-system/legacy';

export type NoteRecord = {
  id: number;
  dateKey: string;
  note: string;
  moonDayId: number | null;
};

export type NoteInput = {
  moonDayId: number;
  note: string;
};

export type NotesDbAdapter = {
  execute: (
    sql: string,
    params?: (string | number)[]
  ) => Promise<{ rows: { length: number; item: (index: number) => any }; insertId?: number }>;
};

export const createNotesDbAdapter = (): NotesDbAdapter => ({
  execute: (sql, params = []) => executeNotesSql(sql, params),
});

export const createNotesRepository = (adapter: NotesDbAdapter) => {
  let initDone = false;
  const init = async () => {
    if (initDone) return;
    // Migrate legacy notes DB from native Android databases/ directory if present
    // documentDirectory is like: file:///data/user/0/com.crbee.mooncalendar/files/
    const legacyPath = (FileSystem.documentDirectory ?? '').replace('/files/', '/databases/') + 'DB_NOTES.db';
    await migrateLegacyNotesIfPresent(legacyPath);
    await initNotesDb();
    initDone = true;
  };

  const mapRow = (row: any): NoteRecord => {
    const dateKey = row.date as string;
    return {
      id: row.note_id as number,
      dateKey,
      note: row.note as string,
      moonDayId: parseMoonDayId(dateKey),
    };
  };

  const getAllNotes = async (): Promise<NoteRecord[]> => {
    await init();
    const result = await adapter.execute(`SELECT note_id, date, note FROM ${NOTES_TABLE} ORDER BY note_id DESC`);
    const notes: NoteRecord[] = [];
    for (let i = 0; i < result.rows.length; i += 1) {
      notes.push(mapRow(result.rows.item(i)));
    }
    return notes;
  };

  const getNoteByMoonDayIndex = async (moonDayId: number): Promise<NoteRecord | null> => {
    await init();
    const dateKey = makeMoonDayKey(moonDayId);
    const result = await adapter.execute(
      `SELECT note_id, date, note FROM ${NOTES_TABLE} WHERE date = ? LIMIT 1`,
      [dateKey]
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows.item(0));
  };

  const addNote = async ({ moonDayId, note }: NoteInput): Promise<number> => {
    await init();
    const dateKey = makeMoonDayKey(moonDayId);
    const result = await adapter.execute(
      `INSERT INTO ${NOTES_TABLE} (date, note) VALUES (?, ?)` ,
      [dateKey, note]
    );
    return result.insertId as number;
  };

  const updateNote = async ({ noteId, moonDayId, note }: { noteId: number; moonDayId: number; note: string }) => {
    await init();
    const dateKey = makeMoonDayKey(moonDayId);
    await adapter.execute(
      `UPDATE ${NOTES_TABLE} SET date = ?, note = ? WHERE note_id = ?`,
      [dateKey, note, noteId]
    );
  };

  const deleteNote = async (noteId: number) => {
    await init();
    await adapter.execute(`DELETE FROM ${NOTES_TABLE} WHERE note_id = ?`, [noteId]);
  };

  const replaceAll = async (notes: NoteRecord[]) => {
    await init();
    await adapter.execute(`DELETE FROM ${NOTES_TABLE}`);
    for (const note of notes) {
      const dateKey = note.dateKey;
      await adapter.execute(`INSERT INTO ${NOTES_TABLE} (note_id, date, note) VALUES (?, ?, ?)`, [
        note.id,
        dateKey,
        note.note,
      ]);
    }
  };

  return {
    init,
    getAllNotes,
    getNoteByMoonDayIndex,
    addNote,
    updateNote,
    deleteNote,
    replaceAll,
  };
};
