import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { createNotesRepository, createNotesDbAdapter, NoteRecord } from '../notes/notesRepository';

const repo = createNotesRepository(createNotesDbAdapter());

const BACKUP_FILENAME = 'moon_notes_backup.json';

export const exportNotes = async () => {
  const notes = await repo.getAllNotes();
  const payload = JSON.stringify({ version: 1, notes });
  const uri = `${FileSystem.cacheDirectory}${BACKUP_FILENAME}`;
  await FileSystem.writeAsStringAsync(uri, payload, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export notes' });
  }
  return uri;
};

export const importNotes = async () => {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return { imported: 0 };
  const fileUri = result.assets[0].uri;
  const content = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });
  const parsed = JSON.parse(content) as { version: number; notes: NoteRecord[] };
  if (!parsed || !Array.isArray(parsed.notes)) throw new Error('Invalid backup file');
  await repo.replaceAll(parsed.notes);
  return { imported: parsed.notes.length };
};

