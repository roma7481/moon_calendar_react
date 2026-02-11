import moment, { Moment } from 'moment-timezone';
import * as suncalc from 'suncalc';
import lune from 'lune';
import _ from 'lodash';

export type LunarDay = {
  number: number;
  start: number;
  end: number;
};

type LunarDayInternal = {
  number: number;
  start: Moment;
  end: Moment;
};

const isDayBetween = (start: Moment, end: Moment, day: Moment | Date | string) => {
  const dayMoment = moment(day);
  return (
    dayMoment.startOf('day').isBetween(moment(start), moment(end)) ||
    dayMoment.endOf('day').isBetween(moment(start), moment(end))
  );
};

const daysRange = (startDate: Moment, numberOfDays: number) => {
  return _.map(_.range(0, numberOfDays + 1), (i) =>
    moment(moment(startDate).startOf('day').add(i, 'days'))
  );
};

const recentNewMoon = (date: Moment | Date) => {
  let endOfDate = moment(date).endOf('day').toDate();
  let startOfDate = moment(date).startOf('day').toDate();

  let recentPhases = lune.phase_hunt(endOfDate);

  if (recentPhases.new_date > endOfDate) {
    recentPhases = lune.phase_hunt(startOfDate);
  }

  return moment(recentPhases.new_date);
};

const daysBetween = (start: Moment, end: Moment | Date) => {
  return moment(end).endOf('day').diff(moment(start).startOf('day'), 'days');
};

const moonRises = (days: Moment[], latitude: number, longitude: number) => {
  return _.chain(days)
    .map((day) => suncalc.getMoonTimes(moment(day).toDate(), latitude, longitude).rise)
    .filter((rise) => rise)
    .map((rise) => moment(rise))
    .value() as Moment[];
};

const getMissingDays = (res: LunarDayInternal[], resPrev: LunarDayInternal[], date: Moment) => {
  const currentMoonDay = res[0];
  const newRes: LunarDayInternal[] = [];

  const today = moment(date).startOf('day').toDate();

  if (currentMoonDay.number === 1) {
    const prevMoonDay = resPrev[resPrev.length - 1];

    if (today.getTime() < prevMoonDay.end.valueOf() && prevMoonDay.number !== currentMoonDay.number) {
      newRes.push(prevMoonDay);
    }

    const minutesDiff = (currentMoonDay.start as any).diff(prevMoonDay.end, prevMoonDay as any);
    if (minutesDiff > 0 && prevMoonDay.number !== currentMoonDay.number) {
      const missingDay: LunarDayInternal = {
        number: prevMoonDay.number + 1,
        start: prevMoonDay.end,
        end: currentMoonDay.start,
      };
      newRes.push(missingDay);
    }
  } else if (currentMoonDay.number === 2) {
    const prevMoonDay = resPrev[resPrev.length - 1];
    if (prevMoonDay.number !== 1) {
      const minutesDiff = (currentMoonDay.start as any).diff(prevMoonDay.end, prevMoonDay as any);
      if (minutesDiff > 0) {
        const missingDay: LunarDayInternal = {
          number: 1,
          start: prevMoonDay.end,
          end: currentMoonDay.start,
        };

        if (today.getTime() < prevMoonDay.end.valueOf() && prevMoonDay.number !== currentMoonDay.number) {
          newRes.push(prevMoonDay);
        }

        if (today.getTime() < missingDay.end.valueOf()) {
          newRes.push(missingDay);
        }
      } else {
        const updatedTime = currentMoonDay.start.clone();
        updatedTime.add(-2, 'hours');

        const missingDay: LunarDayInternal = {
          number: 1,
          start: updatedTime,
          end: currentMoonDay.start,
        };

        if (today.getTime() < prevMoonDay.end.valueOf() && prevMoonDay.number !== currentMoonDay.number) {
          newRes.push({
            number: prevMoonDay.number,
            start: prevMoonDay.start,
            end: updatedTime,
          });
        }

        if (today.getTime() < missingDay.end.valueOf()) {
          newRes.push(missingDay);
        }
      }
    }
  }

  for (let i = 0; i < res.length; i += 1) {
    newRes.push(res[i]);
  }

  return newRes;
};

const getFormattedDays = (res: LunarDayInternal[]) => {
  return res.map((item) => ({
    number: item.number,
    start: item.start.valueOf(),
    end: item.end.valueOf(),
  }));
};

const getPrevlunarDaysInternal = (date: Moment, latitude: number, longitude: number) => {
  const prevDate = moment(date).add(-1, 'd').toDate();
  return getLunarDaysInternal(prevDate, latitude, longitude);
};

const getLunarDaysInternal = (date: Moment | Date, latitude: number, longitude: number) => {
  const newMoon = recentNewMoon(date);
  const diffDays = daysBetween(newMoon, date);
  const initDate = moment(newMoon).startOf('day');

  const days = daysRange(initDate, diffDays + 4);

  let rises = moonRises(days, latitude, longitude);
  if (moment(_.head(rises)).isSameOrBefore(newMoon)) {
    rises = _.drop(rises) as Moment[];
  }

  const moonDays: LunarDayInternal[] = [
    {
      number: 1,
      start: newMoon,
      end: _.head(rises) as Moment,
    },
  ];

  for (let i = 0; i < rises.length - 1; i += 1) {
    moonDays.push({
      number: i + 2,
      start: rises[i],
      end: rises[i + 1],
    });
  }

  return _.filter(moonDays, ({ start, end }) => isDayBetween(start, end, date)) as LunarDayInternal[];
};

const getAllDaysInMonth = (month: number, year: number) =>
  new Array(31)
    .fill('')
    .map((_, i) => new Date(year, month - 1, i + 1))
    .filter((v) => v.getMonth() === month - 1);

const lunarDays = (date: any, latitude: number, longitude: number, timezone?: string) => {
  const tzDate = moment.tz(date, 'DD-MM-YYYY', timezone as any);
  const res = getLunarDaysInternal(tzDate, latitude, longitude);
  const resPrev = getPrevlunarDaysInternal(tzDate, latitude, longitude);
  return getFormattedDays(getMissingDays(res, resPrev, tzDate));
};

const allLunarDaysInMonth = (
  currentMonth: number,
  currentYear: number,
  latitude: number,
  longitude: number,
  timezone: string
) => {
  const allMonthDates = getAllDaysInMonth(currentMonth, currentYear);
  const lunarDates: LunarDay[][] = [];

  for (const date of allMonthDates) {
    lunarDates.push(lunarDays(moment.tz(date as any, 'DD-MM-YYYY', timezone) as any, latitude, longitude));
  }

  return lunarDates;
};

export const lunarDaysForDayOrMonth = (
  date: string,
  month: number,
  year: number,
  latitude: number,
  longitude: number,
  timezone: string,
  isMonth: boolean
): LunarDay[] | LunarDay[][] => {
  if (isMonth) {
    return allLunarDaysInMonth(month, year, latitude, longitude, timezone);
  }
  return lunarDays(date, latitude, longitude, timezone);
};

export const calcMoonDays = (date: Date, lat: number, lon: number, tz: string): LunarDay[] => {
  const day = moment(date).tz(tz).format('DD-MM-YYYY');
  return lunarDaysForDayOrMonth(day, date.getMonth() + 1, date.getFullYear(), lat, lon, tz, false) as LunarDay[];
};

export const calcMoonMonth = (date: Date, lat: number, lon: number, tz: string): LunarDay[][] => {
  const day = moment(date).tz(tz).format('DD-MM-YYYY');
  return lunarDaysForDayOrMonth(day, date.getMonth() + 1, date.getFullYear(), lat, lon, tz, true) as LunarDay[][];
};
