import { LunarDay } from '../moon/lunar';

const SunCalc = {
  J2000: 2451545,
  DEG2RAD: Math.PI / 180,
  RAD2DEG: 180 / Math.PI,
};

export const zodiacOrder = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
] as const;

export type Zodiac = (typeof zodiacOrder)[number];

const dateToJulianDate = (date: Date) => {
  const julianEpoch = new Date(Date.UTC(-4713, 10, 24, 12, 0, 0));
  return (date.getTime() - julianEpoch.getTime()) / (1000 * 60 * 60 * 24);
};

const mod = (a: number, b: number) => a - Math.floor(a / b) * b;
const mod2Pi = (x: number) => mod(x, 2 * Math.PI);

export const calcMoonZodiac = (moonDays: LunarDay[], moonDayIndex?: number): Zodiac => {
  let moonDay = moonDays[0];
  if (moonDayIndex != null) {
    const found = moonDays.find((item) => item.number === moonDayIndex);
    if (found) moonDay = found;
  }

  const date = new Date(moonDay.end);
  const julianDate = dateToJulianDate(date);
  const d = julianDate - 2447891.5;

  const anomalyMean = (((360 * SunCalc.DEG2RAD) / 365.242191) * d + 4.87650757829735) - 4.935239984568769;
  const nu = anomalyMean + (((360 * SunCalc.DEG2RAD) / Math.PI) * 0.016713) * Math.sin(anomalyMean);
  const sunLon = mod2Pi(nu + 4.935239984568769);

  const l0 = 318.351648 * SunCalc.DEG2RAD;
  const p0 = 36.34041 * SunCalc.DEG2RAD;
  const n0 = 318.510107 * SunCalc.DEG2RAD;
  const i = 5.145396 * SunCalc.DEG2RAD;
  const l = (13.1763966 * SunCalc.DEG2RAD) * d + l0;
  const mMoon = l - (0.1114041 * SunCalc.DEG2RAD) * d - p0;
  const n = n0 - (0.0529539 * SunCalc.DEG2RAD) * d;
  const c = l - sunLon;
  const ev = (1.2739 * SunCalc.DEG2RAD) * Math.sin(2 * c - mMoon);
  const ae = (0.1858 * SunCalc.DEG2RAD) * Math.sin(anomalyMean);
  const a3 = (0.37 * SunCalc.DEG2RAD) * Math.sin(anomalyMean);
  const mMoon2 = mMoon + ev - ae - a3;
  const ec = (6.2886 * SunCalc.DEG2RAD) * Math.sin(mMoon2);
  const a4 = (0.214 * SunCalc.DEG2RAD) * Math.sin(2 * mMoon2);
  const l2 = l + ev + ec - ae + a4;
  const v = (0.6583 * SunCalc.DEG2RAD) * Math.sin(2 * (l2 - sunLon));
  const l3 = l2 + v;
  const n2 = n - (0.16 * SunCalc.DEG2RAD) * Math.sin(anomalyMean);
  const moonLon = mod2Pi(n2 + Math.atan2(Math.sin(l3 - n2) * Math.cos(i), Math.cos(l3 - n2)));
  const idxd = Math.floor((moonLon * SunCalc.RAD2DEG) / 30);

  const idx = idxd < 0 ? Math.ceil(idxd) : Math.floor(idxd);
  const safeIdx = ((idx % zodiacOrder.length) + zodiacOrder.length) % zodiacOrder.length;

  return zodiacOrder[safeIdx];
};
