/* @flow strict-local */
import format from 'date-fns/format';
import isToday from 'date-fns/is_today';
import isYesterday from 'date-fns/is_yesterday';
import isSameYear from 'date-fns/is_same_year';

// We import `moment` here only to ensure we get the version of moment with all
// the locale data. We don't have any need to use the symbols directly.
//
/* eslint-disable no-unused-vars */
/* eslint-disable import/no-extraneous-dependencies */
// flowlint untyped-import:off
import _moment_unused from 'moment/min/moment-with-locales';
// flowlint untyped-import:error
/* eslint-enable import/no-extraneous-dependencies */
/* eslint-enable no-unused-vars */

import moment from 'moment-timezone/builds/moment-timezone-with-data';

export { default as isSameDay } from 'date-fns/is_same_day';

export const shortTime = (date: Date, twentyFourHourTime: boolean = false): string =>
  format(date, twentyFourHourTime ? 'H:mm' : 'h:mm A');

export const shortDate = (date: Date): string => format(date, 'MMM D');

export const longDate = (date: Date): string => format(date, 'MMM D, YYYY');

export const daysInDate = (date: Date): number => Math.trunc(date / 1000 / 60 / 60 / 24);

export const humanDate = (date: Date): string => {
  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }

  return isSameYear(new Date(date), new Date()) ? shortDate(date) : longDate(date);
};

export const nowInTimeZone = (timezone: string): number | null => {
  if (!moment.tz.zone(timezone)) {
    return null;
  }
  return moment.tz(new Date(), timezone).unix();
};

export const nowInTimeZoneF = (timezone: string, locale: string): string | null => {
  if (!moment.tz.zone(timezone)) {
    return null;
  }
  return moment
    .tz(new Date(), timezone)
    .locale(locale)
    .format('LT');
};
