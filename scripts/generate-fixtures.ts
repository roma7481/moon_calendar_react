import fs from 'fs';
import path from 'path';
import { lunarDaysForDayOrMonth } from '../src/domain/moon/lunar';
import { calcMoonZodiac } from '../src/domain/zodiac/zodiac';

const cases = [
  {
    id: 'nyc-2026-02-08',
    date: '2026-02-08',
    timezone: 'America/New_York',
    latitude: 40.714,
    longitude: -74.006,
  },
  {
    id: 'moscow-2026-02-08',
    date: '2026-02-08',
    timezone: 'Europe/Moscow',
    latitude: 55.7558,
    longitude: 37.6173,
  },
  {
    id: 'sydney-2026-06-15',
    date: '2026-06-15',
    timezone: 'Australia/Sydney',
    latitude: -33.8688,
    longitude: 151.2093,
  },
  {
    id: 'tokyo-2026-12-01',
    date: '2026-12-01',
    timezone: 'Asia/Tokyo',
    latitude: 35.6762,
    longitude: 139.6503,
  },
];

const toCalcDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const dayStr = `${day}`.padStart(2, '0');
  const monthStr = `${month}`.padStart(2, '0');
  return { year, month, dayStr, monthStr };
};

const fixtures = cases.map((fixture) => {
  const { year, month, dayStr, monthStr } = toCalcDate(fixture.date);
  const calcDate = `${dayStr}-${monthStr}-${year}`;

  const moonDays = lunarDaysForDayOrMonth(
    calcDate,
    month,
    year,
    fixture.latitude,
    fixture.longitude,
    fixture.timezone,
    false
  ) as { number: number; start: number; end: number }[];

  const sorted = [...moonDays].sort((a, b) => a.number - b.number);
  const zodiac = calcMoonZodiac(sorted);

  return {
    id: fixture.id,
    date: fixture.date,
    timezone: fixture.timezone,
    latitude: fixture.latitude,
    longitude: fixture.longitude,
    expected: {
      moonDays: sorted,
      zodiac,
    },
  };
});

const outputPath = path.resolve(__dirname, 'fixtures.json');
fs.writeFileSync(
  outputPath,
  JSON.stringify({ generatedAt: new Date().toISOString(), cases: fixtures }, null, 2)
);

console.log(`Wrote fixtures to ${outputPath}`);
