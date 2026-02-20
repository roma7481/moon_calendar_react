import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const DB_NAME = 'moon_calendar_translated_2_v2.db';
const DB_DIR = `${FileSystem.documentDirectory}SQLite`;
const DB_PATH = `${DB_DIR}/${DB_NAME}`;

let cachedDb: SQLiteDatabase | null = null;
let dbReady: Promise<void> | null = null;
let queryChain: Promise<void> = Promise.resolve();
let recoveryInFlight: Promise<void> | null = null;
let recoveryCount = 0;
let lastRecoveryTime = 0;

const REQUIRED_TABLES = [
  'MOON_DAY_INFO_ENG',
  'MOON_DAY_INFO_RU',
  'MOON_DAY_INFO_JA',
  'CITIES_ENG',
  'CITIES_RU',
  'CITIES_JA',
  'ZODIAC_INFO_ENG',
  'ZODIAC_INFO_RU',
  'ZODIAC_INFO_JA',
];

const copyDbAsset = async () => {
  const asset = Asset.fromModule(require('../../assets/database/moon_calendar_translated_2.db'));
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('Failed to load database asset.');
  }

  console.log('[DB] Copying database from assets:', asset.localUri);

  // Check if source file exists and has size
  const assetInfo = await FileSystem.getInfoAsync(asset.localUri);
  if (!assetInfo.exists) {
    throw new Error('Database asset file does not exist at: ' + asset.localUri);
  }
  if (assetInfo.size === 0) {
    throw new Error('Database asset file is empty (0 bytes)');
  }

  console.log('[DB] Asset database size:', assetInfo.size, 'bytes');

  await FileSystem.copyAsync({ from: asset.localUri, to: DB_PATH });

  // Verify the copy succeeded
  const copiedInfo = await FileSystem.getInfoAsync(DB_PATH);
  if (!copiedInfo.exists || copiedInfo.size === 0) {
    throw new Error('Database copy failed - file is missing or empty');
  }

  console.log('[DB] Database copied successfully:', copiedInfo.size, 'bytes');
};

const hasRequiredTables = async (db: SQLiteDatabase) => {
  try {
    const rows = (await db.getAllAsync("select name from sqlite_master where type='table'")) as { name: string }[];
    const names = new Set(rows.map((row) => row.name));
    return REQUIRED_TABLES.every((table) => names.has(table));
  } catch {
    return false;
  }
};

const ensureDb = async () => {
  const dirInfo = await FileSystem.getInfoAsync(DB_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DB_DIR, { intermediates: true });
  }

  const dbInfo = await FileSystem.getInfoAsync(DB_PATH);
  if (!dbInfo.exists) {
    await copyDbAsset();
    return;
  }

  let db: SQLiteDatabase | null = null;
  try {
    db = await openDatabaseAsync(DB_NAME);
    const ok = await hasRequiredTables(db);
    if (!ok) {
      await db.closeAsync();
      await FileSystem.deleteAsync(DB_PATH, { idempotent: true });
      await copyDbAsset();
    }
  } catch {
    if (db) {
      try {
        await db.closeAsync();
      } catch {
        // ignore
      }
    }
    await FileSystem.deleteAsync(DB_PATH, { idempotent: true });
    await copyDbAsset();
  }
};

export const getDb = async () => {
  if (!dbReady) {
    dbReady = ensureDb();
  }

  try {
    await dbReady;

    if (!cachedDb) {
      cachedDb = await openDatabaseAsync(DB_NAME);
    }

    return cachedDb;
  } catch (error) {
    // If database initialization fails, reset and retry once
    console.error('[DB] getDb failed, attempting recovery:', error);
    cachedDb = null;
    dbReady = null;
    await ensureDb();
    cachedDb = await openDatabaseAsync(DB_NAME);
    return cachedDb;
  }
};

const recoverDb = async () => {
  if (recoveryInFlight) {
    console.log('[DB] Recovery already in progress, waiting...');
    return recoveryInFlight;
  }

  recoveryInFlight = (async () => {
    console.log('[DB] Starting database recovery...');

    // Force close cached database
    if (cachedDb) {
      try {
        await cachedDb.closeAsync();
        console.log('[DB] Closed existing database connection');
      } catch (error) {
        console.log('[DB] Error closing database (may already be closed):', error);
      }
      cachedDb = null;
    }

    // Reset initialization flag
    dbReady = null;

    // Add delay to ensure native module releases resources
    await new Promise(resolve => setTimeout(resolve, 200));

    // Force delete and recreate database
    try {
      await FileSystem.deleteAsync(DB_PATH, { idempotent: true });
      console.log('[DB] Deleted corrupted database');
    } catch (error) {
      console.error('[DB] Error deleting database:', error);
    }

    // Copy fresh database from assets
    await copyDbAsset();
    console.log('[DB] Copied fresh database from assets');

    // Add delay before opening to let file system stabilize
    await new Promise(resolve => setTimeout(resolve, 200));

    // Reinitialize through proper flow
    dbReady = ensureDb();
    await dbReady;
    cachedDb = await openDatabaseAsync(DB_NAME);
    console.log('[DB] Database reopened');

    // Validate the database is actually working
    try {
      const testResult = await cachedDb.getAllAsync("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1");
      console.log('[DB] Database validation successful, found', testResult.length, 'tables');

      // Reset recovery count on successful validation
      recoveryCount = 0;
      console.log('[DB] Recovery complete - reset recovery count');
    } catch (validationError) {
      console.error('[DB] Database validation failed after recovery:', validationError);
      throw new Error('Database validation failed after recovery');
    }
  })();

  try {
    await recoveryInFlight;
  } finally {
    recoveryInFlight = null;
  }
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
  const task = async () => {
    let lastError: any = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
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
      } catch (error) {
        lastError = error;
        const message = String((error as Error)?.message ?? error ?? '');
        const shouldRecover =
          message.includes('prepareAsync') ||
          message.includes('NativeDatabase') ||
          message.includes('NullPointerException') ||
          message.includes('closed') ||
          message.includes('database');

        if (shouldRecover && attempts < maxAttempts - 1) {
          const now = Date.now();
          // Reset recovery count if it's been more than 60 seconds since last recovery
          if (now - lastRecoveryTime > 60000) {
            console.log('[DB] Resetting recovery count (60s elapsed since last recovery)');
            recoveryCount = 0;
          }
          lastRecoveryTime = now;
          recoveryCount++;

          // Prevent infinite recovery loop across all queries
          // Allow up to 5 recovery attempts within 60 seconds
          if (recoveryCount > 5) {
            console.error('[DB] Too many recovery attempts (' + recoveryCount + '), giving up gracefully');
            console.error('[DB] This may indicate a corrupted database file in assets or a device-specific issue');
            console.error('[DB] Try: 1) Reinstall the app, 2) Clear app data, 3) Check device storage');
            console.log('[DB] Returning empty result to prevent app crash');
            // Return empty result instead of throwing error to user
            return { rows: wrapRows([]), rowsAffected: 0 };
          }

          console.log('[DB] Database error detected (query attempt ' + (attempts + 1) + ', global recovery ' + recoveryCount + '), recovering:', message);

          try {
            await recoverDb();
            console.log('[DB] Recovery complete, retrying query...');
            attempts++;
            // Add delay to let native module stabilize
            await new Promise(resolve => setTimeout(resolve, 200));
            continue; // Retry the query
          } catch (recoveryError) {
            console.error('[DB] Recovery failed:', recoveryError);
            console.log('[DB] Returning empty result to prevent error screen');
            // Return empty result instead of throwing
            return { rows: wrapRows([]), rowsAffected: 0 };
          }
        }

        // If not recoverable, return empty result to prevent user-facing error
        if (shouldRecover) {
          console.error('[DB] Database error (not recoverable or out of attempts):', message);
          console.log('[DB] Returning empty result to prevent app crash');
          return { rows: wrapRows([]), rowsAffected: 0 };
        }

        // Only throw error if it's not a database-related error
        throw error;
      }
    }

    // If we exhausted all attempts, return empty result instead of throwing
    console.error('[DB] Exhausted all query attempts, returning empty result');
    console.error('[DB] Last error:', lastError);
    return { rows: wrapRows([]), rowsAffected: 0 };
  };

  const run = queryChain.then(task, task);
  queryChain = run.then(
    () => {},
    () => {}
  );
  return run;
};
