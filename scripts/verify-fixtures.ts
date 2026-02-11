import fs from 'fs';
import path from 'path';
import { lunarDaysForDayOrMonth } from '../src/domain/moon/lunar';
import { calcMoonZodiac } from '../src/domain/zodiac/zodiac';

const TOLERANCE_MS = 60 * 1000;

const fixturesPath = path.resolve(__dirname, 'fixtures.json');
const raw = fs.readFileSync(fixturesPath, 'utf-8');
const data = JSON.parse(raw) as {
  generatedAt: string;
  cases: Array<{
    id: string;
    date: string;
    timezone: string;
    latitude: number;
    longitude: number;
    expected: {
      moonDays: Array<{ number: number; start: number; end: number }>;
      zodiac: string;
    };
  }>;
};

const toCalcDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const dayStr = `${day}`.padStart(2, '0');
  const monthStr = `${month}`.padStart(2, '0');
  return { year, month, dayStr, monthStr };
};

let failures = 0;

for (const fixture of data.cases) {
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

  const expected = fixture.expected.moonDays;

  if (sorted.length !== expected.length) {
    console.error(`[${fixture.id}] Moon day length mismatch: expected ${expected.length}, got ${sorted.length}`);
    failures += 1;
    continue;
  }

  sorted.forEach((item, index) => {
    const exp = expected[index];
    if (item.number !== exp.number) {
      console.error(`[${fixture.id}] Moon day number mismatch at ${index}: expected ${exp.number}, got ${item.number}`);
      failures += 1;
      return;
    }

    const startDiff = Math.abs(item.start - exp.start);
    const endDiff = Math.abs(item.end - exp.end);

    if (startDiff > TOLERANCE_MS || endDiff > TOLERANCE_MS) {
      console.error(
        `[${fixture.id}] Moon day time drift at ${index}: start diff ${startDiff}ms, end diff ${endDiff}ms`
      );
      failures += 1;
    }
  });

  if (zodiac !== fixture.expected.zodiac) {
    console.error(`[${fixture.id}] Zodiac mismatch: expected ${fixture.expected.zodiac}, got ${zodiac}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`\nFixture verification failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log('All fixtures passed.');
