import assert from 'assert';
import { makeMoonDayKey, parseMoonDayId } from '../src/notes/notesMapping';
import { createNotesRepository, NotesDbAdapter } from '../src/notes/notesRepository';

const makeRows = (items: any[]) => ({
  length: items.length,
  item: (index: number) => items[index],
});

const makeAdapter = (rowsItems: any[] = []) => {
  const calls: Array<{ sql: string; params: (string | number)[] }> = [];
  const adapter: NotesDbAdapter = {
    execute: async (sql, params = []) => {
      calls.push({ sql, params });
      return { rows: makeRows(rowsItems), insertId: 42 } as any;
    },
  };
  return { adapter, calls };
};

(() => {
  assert.strictEqual(makeMoonDayKey(21), 'NOTES_DAY_21');
  assert.strictEqual(parseMoonDayId('NOTES_DAY_21'), 21);
  assert.strictEqual(parseMoonDayId('invalid'), null);
})();

(async () => {
  const { adapter, calls } = makeAdapter([{ note_id: 1, date: 'NOTES_DAY_2', note: 'Hello' }]);
  const repo = createNotesRepository(adapter);

  const note = await repo.getNoteByMoonDayIndex(2);
  assert.ok(note);
  assert.strictEqual(note?.moonDayId, 2);
  assert.strictEqual(calls[calls.length - 1].params[0], 'NOTES_DAY_2');
})();

(async () => {
  const { adapter, calls } = makeAdapter([]);
  const repo = createNotesRepository(adapter);
  await repo.addNote({ moonDayId: 7, note: 'Test' });
  const last = calls[calls.length - 1];
  assert.ok(last.sql.includes('INSERT INTO'));
  assert.deepStrictEqual(last.params, ['NOTES_DAY_7', 'Test']);
})();

console.log('notesRepository tests passed');
