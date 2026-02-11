import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';

export const NOTES_DB_NAME = 'DB_NOTES.db';
export const NOTES_TABLE = 'TABLE_NOTE';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${NOTES_TABLE} (
  note_id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  note TEXT NOT NULL
);
`;

let cachedDb: SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

const getDb = async () => {
  if (!cachedDb) {
    cachedDb = await openDatabaseAsync(NOTES_DB_NAME);
  }
  return cachedDb;
};

type LegacyRows = {
  length: number;
  item: (index: number) => any;
};

export type LegacyResultSet = {
  rows: LegacyRows;
  insertId?: number;
  rowsAffected?: number;
};

const isReadQuery = (sql: string) => {
  const head = sql.trim().split(/\s+/)[0]?.toUpperCase();
  return head === 'SELECT' || head === 'PRAGMA' || head === 'WITH';
};

const wrapRows = (rows: any[]): LegacyRows => ({
  length: rows.length,
  item: (index: number) => rows[index],
});

export const executeNotesSql = async (sql: string, params: (string | number)[] = []): Promise<LegacyResultSet> => {
  const db = await getDb();
  if (isReadQuery(sql)) {
    const rows = await db.getAllAsync(sql, params);
    return { rows: wrapRows(rows) };
  }
  const result = await db.runAsync(sql, params);
  return {
    rows: wrapRows([]),
    insertId: typeof result.lastInsertRowId === 'number' ? result.lastInsertRowId : undefined,
    rowsAffected: result.changes,
  };
};

export const initNotesDb = async () => {
  if (!initPromise) {
    initPromise = executeNotesSql(CREATE_TABLE_SQL).then(() => undefined);
  }
  await initPromise;
};

// Optional migration utility.
// If you have a legacy DB file path, pass it to migrate it into Expo's SQLite folder.
export const migrateLegacyNotesIfPresent = async (legacyPath: string) => {
  const dbDir = `${FileSystem.documentDirectory}SQLite`;
  const dbPath = `${dbDir}/${NOTES_DB_NAME}`;

  const [legacyInfo, currentInfo] = await Promise.all([
    FileSystem.getInfoAsync(legacyPath),
    FileSystem.getInfoAsync(dbPath),
  ]);

  if (!legacyInfo.exists || currentInfo.exists) return false;

  const dirInfo = await FileSystem.getInfoAsync(dbDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
  }

  await FileSystem.copyAsync({ from: legacyPath, to: dbPath });
  return true;
};

export const NOTES_SQL = {
  CREATE_TABLE_SQL,
};
