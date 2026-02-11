export const NOTE_DATE_PREFIX = 'NOTES_DAY_';

export const makeMoonDayKey = (moonDayId: number) => `${NOTE_DATE_PREFIX}${moonDayId}`;

export const parseMoonDayId = (dateKey: string): number | null => {
  if (!dateKey?.startsWith(NOTE_DATE_PREFIX)) return null;
  const raw = dateKey.slice(NOTE_DATE_PREFIX.length);
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};
