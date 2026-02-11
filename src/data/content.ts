import { executeSql } from './db';

export type AppLocale = 'en' | 'ru';

export type City = {
  name: string;
  latitude: number;
  longitude: number;
};

export type MoonDayInfo = {
  dayNumber: number;
  dayCharacteristics?: string;
  personality?: string;
  business?: string;
  health?: string;
  haircut?: string;
  relations?: string;
  marriage?: string;
  birthday?: string;
  recommendations?: string;
  warnings?: string;
  dreams?: string;
  manicure?: string;
  diet?: string;
  shopping?: string;
  garden?: string;
};

export type ZodiacInfo = {
  zodiac: string;
  name: string;
  info?: string;
};

const runSql = (sql: string, params: (string | number)[] = []) => executeSql(sql, params);

const tableFor = (base: string, locale: AppLocale) => `${base}_${locale === 'ru' ? 'RU' : 'ENG'}`;

export const getCityByName = async (name: string, locale: AppLocale): Promise<City | null> => {
  const tableName = tableFor('CITIES', locale);
  const result = await runSql(
    `select NAME, LATITUDE, LONGITUDE from ${tableName} where NAME = ? collate nocase limit 1`,
    [name]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows.item(0) as { NAME: string; LATITUDE: string; LONGITUDE: string };
  return {
    name: row.NAME,
    latitude: Number(row.LATITUDE),
    longitude: Number(row.LONGITUDE),
  };
};

const getGardenZodiacInfo = async (zodiac: string): Promise<string | null> => {
  const result = await runSql(
    'select INFO from ZODIAC_GARDEN_RU where ZODIAC = ? collate nocase limit 1',
    [zodiac]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows.item(0) as { INFO: string };
  return row.INFO;
};

export const getMoonDayInfo = async (
  dayNumber: number,
  locale: AppLocale,
  zodiac?: string
): Promise<MoonDayInfo | null> => {
  const tableName = tableFor('MOON_DAY_INFO', locale);
  const result = await runSql(
    `select MOON_DATE_NUMBER, DAY_CHARACTERISTICS, INFLUENCE_ON_PERSONALITY, BUSINESS, HEALTH, HAIRCUT, RELATIONS, MARRIAGE, BIRTHDAY, RECOMMENDATIONS, WARNINGS, DREAMS, MANICURE, DIET, SHOPPING, GARDEN from ${tableName} where CAST(MOON_DATE_NUMBER AS INTEGER) = ? limit 1`,
    [dayNumber]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows.item(0) as {
    MOON_DATE_NUMBER: string;
    DAY_CHARACTERISTICS?: string;
    INFLUENCE_ON_PERSONALITY?: string;
    BUSINESS?: string;
    HEALTH?: string;
    HAIRCUT?: string;
    RELATIONS?: string;
    MARRIAGE?: string;
    BIRTHDAY?: string;
    RECOMMENDATIONS?: string;
    WARNINGS?: string;
    DREAMS?: string;
    MANICURE?: string;
    DIET?: string;
    SHOPPING?: string;
    GARDEN?: string;
  };

  let garden = row.GARDEN;

  if (locale === 'ru' && zodiac) {
    const zodiacInfo = await getGardenZodiacInfo(zodiac);
    if (zodiacInfo) {
      garden = `${garden ?? ''}\n\n${zodiacInfo}`.trim();
    }
  }

  return {
    dayNumber: Number(row.MOON_DATE_NUMBER),
    dayCharacteristics: row.DAY_CHARACTERISTICS,
    personality: row.INFLUENCE_ON_PERSONALITY,
    business: row.BUSINESS,
    health: row.HEALTH,
    haircut: row.HAIRCUT,
    relations: row.RELATIONS,
    marriage: row.MARRIAGE,
    birthday: row.BIRTHDAY,
    recommendations: row.RECOMMENDATIONS,
    warnings: row.WARNINGS,
    dreams: row.DREAMS,
    manicure: row.MANICURE,
    diet: row.DIET,
    shopping: row.SHOPPING,
    garden,
  };
};

export const getAllCities = async (locale: AppLocale): Promise<City[]> => {
  const tableName = tableFor('CITIES', locale);
  const result = await runSql(`select NAME, LATITUDE, LONGITUDE from ${tableName} order by NAME asc`);
  const cities: City[] = [];
  for (let i = 0; i < result.rows.length; i += 1) {
    const row = result.rows.item(i) as { NAME: string; LATITUDE: string; LONGITUDE: string };
    cities.push({
      name: row.NAME,
      latitude: Number(row.LATITUDE),
      longitude: Number(row.LONGITUDE),
    });
  }
  return cities;
};

export const getZodiacInfo = async (zodiac: string, locale: AppLocale): Promise<ZodiacInfo | null> => {
  const tableName = tableFor('ZODIAC_INFO', locale);
  const result = await runSql(
    `select ZODIAC, NAME, INFO from ${tableName} where ZODIAC = ? collate nocase limit 1`,
    [zodiac]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows.item(0) as { ZODIAC: string; NAME: string; INFO?: string };
  return {
    zodiac: row.ZODIAC,
    name: row.NAME,
    info: row.INFO,
  };
};
