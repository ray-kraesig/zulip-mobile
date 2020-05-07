import {
  type moment$MomentOptions,
  type moment$MomentObject,
  type moment$MomentCreationData,
  type moment$CalendarFormat,
  type moment$CalendarFormats,
  type moment$Inclusivity,
  // classes
  moment$LocaleData,
  moment$MomentDuration,
  moment$Moment,
} from 'moment';

// Elements of the below are taken from the following gist:
// https://gist.github.com/ggravarr/60516fdd927b408c980d21cd80a3125a

type moment$ZoneObject = {
  name?: string,
  abbrs?: string[],
  untils?: number[],
  offsets?: number[],
  abbr(stamp: number): string,
  zone(stamp: number): string,
  offset(stamp: number): number,
  parse(stamp: number): number,
};

declare class moment$Timezone {
  (
    string?: string,
    format?: string | Array<string>,
    locale?: string,
    strict?: boolean,
    tz: string,
  ): moment_timezone$Moment;
  (
    initDate:
      | ?Object
      | number
      | Date
      | Array<number>
      | moment$Moment
      | moment_timezone$Moment
      | string,
    tz: string,
  ): moment_timezone$Moment;
  setDefault(tz: string): void;
  guess(): void;
  add(packed: string | string[]): void;
  link(packed: string | string[]): void;
  load(bundle: Object): void;
  zone(tz: string): null | moment$ZoneObject;
  names(): string[];
  pack(packed: Object): string;
  unpack(unpacked: string): Object;
  packBase69(base60: number): string;
  unpackBase60(base60: string): number;
  createLinks(bundle: Object): Object;
  filterYears(unpackedZone: Object, startYear: number, endYear?: number): Object;
  filterLinkPack(unpackedZone: Object, startYear: number, endYear?: number): Object;
}

// This is not quite right: the various methods on `moment$Moment` that return
// `moment$Moment` should return `moment_timezone$Moment` here.
declare class moment_timezone$Moment extends moment$Moment {
  parsingFlags(): { [key: string]: any };
  static tz: moment$Timezone;
  tz(tz: string): moment_timezone$Moment;
  tz(): string;
  zoneAbbr(): string;
  zoneName(): string;
}

declare module 'moment-timezone' {
  declare module.exports: Class<moment_timezone$Moment>;
}

// Various alternate versions of the library, with different slices of the
// timezone data included.
declare module 'moment-timezone/builds/moment-timezone-with-data-10-year-range' {
  declare module.exports: Class<moment_timezone$Moment>;
}

declare module 'moment-timezone/builds/moment-timezone-with-data-10-year-range.min' {
  declare module.exports: Class<moment_timezone$Moment>;
}

declare module 'moment-timezone/builds/moment-timezone-with-data-1970-2030' {
  declare module.exports: Class<moment_timezone$Moment>;
}

declare module 'moment-timezone/builds/moment-timezone-with-data-1970-2030.min' {
  declare module.exports: Class<moment_timezone$Moment>;
}

declare module 'moment-timezone/builds/moment-timezone-with-data-2012-2022' {
  declare module.exports: Class<moment_timezone$Moment>;
}

declare module 'moment-timezone/builds/moment-timezone-with-data-2012-2022.min' {
  declare module.exports: Class<moment_timezone$Moment>;
}

declare module 'moment-timezone/builds/moment-timezone-with-data' {
  declare module.exports: Class<moment_timezone$Moment>;
}

declare module 'moment-timezone/builds/moment-timezone-with-data.min' {
  declare module.exports: Class<moment_timezone$Moment>;
}

declare module 'moment-timezone/builds/moment-timezone.min' {
  declare module.exports: Class<moment_timezone$Moment>;
}
