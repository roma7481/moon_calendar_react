import { LunarDay } from './lunar';

export type MoonInfo = {
  phaseName: string;
  illuminationPct: number;
  daysToFullMoon: number | null;
  riseTime: Date;
  setTime: Date;
};

const phaseNameForDay = (dayNumber: number) => {
  if (dayNumber === 1) return 'New Moon';
  if (dayNumber >= 2 && dayNumber <= 7) return 'Waxing Crescent';
  if (dayNumber >= 8 && dayNumber <= 14) return 'Waxing Gibbous';
  if (dayNumber >= 15 && dayNumber <= 16) return 'Full Moon';
  if (dayNumber >= 17 && dayNumber <= 22) return 'Waning Gibbous';
  if (dayNumber >= 23 && dayNumber <= 28) return 'Waning Crescent';
  return 'New Moon';
};

export const calcMoonInfo = (lunarDay: LunarDay): MoonInfo => {
  const illuminationPct = Math.min(100, (100 / 29) * lunarDay.number);
  const daysToFullMoon = lunarDay.number <= 16 ? 16 - lunarDay.number : null;

  return {
    phaseName: phaseNameForDay(lunarDay.number),
    illuminationPct,
    daysToFullMoon,
    riseTime: new Date(lunarDay.start),
    setTime: new Date(lunarDay.end),
  };
};
