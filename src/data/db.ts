import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const DB_NAME = 'moon_calendar_1.db';
const DB_DIR = `${FileSystem.documentDirectory}SQLite`;
const DB_PATH = `${DB_DIR}/${DB_NAME}`;

let cachedDb: SQLiteDatabase | null = null;
let dbReady: Promise<void> | null = null;

const ensureDb = async () => {
  const dirInfo = await FileSystem.getInfoAsync(DB_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DB_DIR, { intermediates: true });
  }

  const dbInfo = await FileSystem.getInfoAsync(DB_PATH);
  if (!dbInfo.exists) {
    const asset = Asset.fromModule(require('../../assets/database/moon_calendar_1.db'));
    await asset.downloadAsync();

    if (!asset.localUri) {
      throw new Error('Failed to load database asset.');
    }

    await FileSystem.copyAsync({ from: asset.localUri, to: DB_PATH });
  }
};

export const getDb = async () => {
  if (!dbReady) {
    dbReady = ensureDb();
  }
  await dbReady;

  if (!cachedDb) {
    cachedDb = await openDatabaseAsync(DB_NAME);
  }

  return cachedDb;
};

export const withDb = async <T>(fn: (db: SQLiteDatabase) => Promise<T>) => {
  const db = await getDb();
  return fn(db);
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

export const executeSql = async (sql: string, params: (string | number)[] = []): Promise<LegacyResultSet> => {
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
