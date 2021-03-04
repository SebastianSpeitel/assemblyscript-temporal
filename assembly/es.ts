// for the proposal-temporal implementation, most of the business logic
// sits within the ecmascript.mjs file:
//
// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs
//
// here we use the same structure to make it easier to audit this implementation
// to ensure correctess

import { Duration } from "./duration";
import { log } from "./env";

// value objects - used in place of object literals
export class YMD {
  constructor(public year: i32, public month: i32, public day: i32) {}
}

export class YM {
  constructor(public year: i32, public month: i32) {}
}

export class NanoDays {
  constructor(
    public days: i32,
    public nanoseconds: i32,
    public dayLengthNs: i64
  ) {}
}

export const enum Overflow {
  Reject,
  Constrain,
}

export const enum TimeComponent {
  years,
  months,
  weeks,
  days,
  hours,
  minutes,
  seconds,
  milliseconds,
  microseconds,
  nanoseconds,
}

// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs#L2157
export function leapYear(year: i32): bool {
  const isDiv4 = year % 4 === 0;
  const isDiv100 = year % 100 === 0;
  const isDiv400 = year % 400 === 0;
  return isDiv4 && (!isDiv100 || isDiv400);
}

// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs#L2188
export function dayOfYear(year: i32, month: i32, day: i32): i32 {
  let days = day;
  for (let m = month - 1; m > 0; m--) {
    days += daysInMonth(year, m);
  }
  return days;
}

// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs#L2164
export function daysInMonth(year: i32, month: i32): i32 {
  const standard: i32[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leapyear: i32[] = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return leapYear(year) ? leapyear[month - 1] : standard[month - 1];
}

// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs#L2171
export function dayOfWeek(year: i32, month: i32, day: i32): i32 {
  const m = month + (month < 3 ? 10 : -2);
  const Y = year - (month < 3 ? 1 : 0);
  const c = Y / 100;
  const y = Y - c * 100;
  const d = day;
  const pD = d;
  const pM = i32(2.6 * f32(m) - 0.2);
  const pY = y + y / 4;
  const pC = c / 4 - 2 * c;
  const dow = (pD + pM + pY + pC) % 7;
  return dow + (dow <= 0 ? 7 : 0);
}

// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs#L2164
function balanceYearMonth(year: i32, month: i32): YM {
  month -= 1;
  year += month / 12;
  month %= 12;
  if (month < 0) month += 12;
  month += 1;
  return new YM(year, month);
}

// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs#L2173
function balanceDate(year: i32, month: i32, day: i32): YMD {
  const _ES$BalanceYearMonth = balanceYearMonth(year, month);

  year = _ES$BalanceYearMonth.year;
  month = _ES$BalanceYearMonth.month;
  let daysInYear = 0;
  let testYear = month > 2 ? year : year - 1;

  while (((daysInYear = leapYear(testYear) ? 366 : 365), day < -daysInYear)) {
    year -= 1;
    testYear -= 1;
    day += daysInYear;
  }

  testYear += 1;

  while (((daysInYear = leapYear(testYear) ? 366 : 365), day > daysInYear)) {
    year += 1;
    testYear += 1;
    day -= daysInYear;
  }

  while (day < 1) {
    const _ES$BalanceYearMonth2 = balanceYearMonth(year, month - 1);

    year = _ES$BalanceYearMonth2.year;
    month = _ES$BalanceYearMonth2.month;
    day += daysInMonth(year, month);
  }

  while (day > daysInMonth(year, month)) {
    day -= daysInMonth(year, month);

    const _ES$BalanceYearMonth3 = balanceYearMonth(year, month + 1);

    year = _ES$BalanceYearMonth3.year;
    month = _ES$BalanceYearMonth3.month;
  }

  return new YMD(year, month, day);
}

function Mathmax(a: i32, b:i32): i32 {
  return a > b ? a : b;
}

function Mathmin(a: i32, b:i32): i32 {
  return a > b ? b : a;
}

// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs#L2616
export function constrainToRange(value: i32, min: i32, max: i32): i32 {
  return Mathmin(max, Mathmax(min, value));
}

// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs#L2617
export function constrainDate(year: i32, month: i32, day: i32): YMD {
  month = constrainToRange(month, 1, 12);
  day = constrainToRange(day, 1, daysInMonth(year, month));
  return new YMD(year, month, day);
}

// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs#L2617
export function regulateDate(
  year: i32,
  month: i32,
  day: i32,
  overflow: Overflow
): YMD {
  switch (overflow) {
    case Overflow.Reject:
      // rejectDate(year, month, day);
      break;

    case Overflow.Constrain:
      const _ES$ConstrainDate = constrainDate(year, month, day);

      year = _ES$ConstrainDate.year;
      month = _ES$ConstrainDate.month;
      day = _ES$ConstrainDate.day;
      break;
  }

  return new YMD(year, month, day);
}

// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs#L2984
export function addDate(
  year: i32,
  month: i32,
  day: i32,
  years: i32,
  months: i32,
  weeks: i32,
  days: i32,
  overflow: Overflow
): YMD {
  year += years;
  month += months;

  const _ES$BalanceYearMonth4 = balanceYearMonth(year, month);

  year = _ES$BalanceYearMonth4.year;
  month = _ES$BalanceYearMonth4.month;

  const _ES$RegulateDate = regulateDate(year, month, day, overflow);

  year = _ES$RegulateDate.year;
  month = _ES$RegulateDate.month;
  day = _ES$RegulateDate.day;
  days += 7 * weeks;
  day += days;

  const _ES$BalanceDate3 = balanceDate(year, month, day);

  year = _ES$BalanceDate3.year;
  month = _ES$BalanceDate3.month;
  day = _ES$BalanceDate3.day;
  return new YMD(year, month, day);
}

// https://github.com/tc39/proposal-temporal/blob/49629f785eee61e9f6641452e01e995f846da3a1/polyfill/lib/ecmascript.mjs#L2135
export function weekOfYear(year: i32, month: i32, day: i32): i32 {
  let doy = dayOfYear(year, month, day);
  let dow = dayOfWeek(year, month, day) || 7;
  let doj = dayOfWeek(year, 1, 1);

  const week = (doy - dow + 10) / 7;

  if (week < 1) {
    if (doj === 5 || (doj === 6 && leapYear(year - 1))) {
      return 53;
    } else {
      return 52;
    }
  }
  if (week === 53) {
    if ((leapYear(year) ? 366 : 365) - doy < 4 - dow) {
      return 1;
    }
  }

  return week;
}

function totalDurationNanoseconds(
  days: i32,
  hours: i32,
  minutes: i32,
  seconds: i32,
  milliseconds: i32,
  microseconds: i32,
  nanoseconds: i32
): i64 {
  const hours64 = i64(hours) + i64(days) * 24;
  const minutes64 = i64(minutes) + hours64 * 60;
  const seconds64 = i64(seconds) + (minutes64 * 60);
  const milliseconds64 = i64(milliseconds) + seconds64 * 1000;
  const microseconds64 = i64(microseconds) + milliseconds64 * 1000;
  return i64(nanoseconds) + microseconds64 * 1000;
}


function Mathabs(x: i32): i32 {
  return x > 0 ? x : -x;
}

function nanosecondsToDays(nanoseconds: i64): NanoDays {
  const sign = i32(nanoseconds > 0) - i32(nanoseconds < 0);

  const dayLengthNs = i64(86400e9);

  if (sign === 0) return new NanoDays(0, 0, dayLengthNs);

  const days = i32(nanoseconds / dayLengthNs);
  const nanosecondsRemainder = i32(nanoseconds % i64(dayLengthNs));
  return new NanoDays(days, nanosecondsRemainder, sign * dayLengthNs);
}

export function balanceDuration(
  days: i32,
  hours: i32,
  minutes: i32,
  seconds: i32,
  milliseconds: i32,
  microseconds: i32,
  nanoseconds: i32,
  largestUnit: TimeComponent
): Duration {
  const nanoseconds64 = totalDurationNanoseconds(
    days,
    hours,
    minutes,
    seconds,
    milliseconds,
    microseconds,
    nanoseconds
  );

  log(nanoseconds64.toString());

  if (
    largestUnit === TimeComponent.years ||
    largestUnit === TimeComponent.months ||
    largestUnit === TimeComponent.weeks ||
    largestUnit === TimeComponent.days
  ) {
    const _ES$NanosecondsToDays = nanosecondsToDays(nanoseconds64);
    
    days = _ES$NanosecondsToDays.days;
    nanoseconds = _ES$NanosecondsToDays.nanoseconds;
    log(days.toString());
  } else {
    days = 0;
  }

  const sign = nanoseconds < 0 ? -1 : 1;
  nanoseconds = Mathabs(nanoseconds);
  microseconds = milliseconds = seconds = minutes = hours = 0;

  switch (largestUnit) {
    case TimeComponent.years:
    case TimeComponent.months:
    case TimeComponent.weeks:
    case TimeComponent.days:
    case TimeComponent.hours:
      microseconds = nanoseconds / 1000;
      nanoseconds = nanoseconds % 1000;

      milliseconds = microseconds / 1000;
      microseconds = microseconds % 1000;

      seconds = i32(milliseconds / 1000);
      milliseconds = milliseconds % 1000;

      minutes = seconds / 60;
      seconds = seconds % 60;

      hours = minutes / 60;
      minutes = minutes % 60;
      break;

    case TimeComponent.minutes:
      microseconds = nanoseconds / 1000;
      nanoseconds = nanoseconds % 1000;

      milliseconds = microseconds / 1000;
      microseconds = microseconds % 1000;

      seconds = milliseconds / 1000;
      milliseconds = milliseconds % 1000;

      minutes = seconds / 60;
      seconds = seconds % 60;
      break;

    case TimeComponent.seconds:
      microseconds = nanoseconds / 1000;
      nanoseconds = nanoseconds % 1000;

      milliseconds = microseconds / 1000;
      microseconds = microseconds % 1000;

      seconds = milliseconds / 1000;
      milliseconds = milliseconds % 1000;
      break;

    case TimeComponent.milliseconds:
      microseconds = nanoseconds / 1000;
      nanoseconds = nanoseconds % 1000;

      milliseconds = microseconds / 1000;
      microseconds = microseconds % 1000;
      break;

    case TimeComponent.microseconds:
      microseconds = nanoseconds / 1000;
      nanoseconds = nanoseconds % 1000;
      break;

    case TimeComponent.nanoseconds:
      break;
  }

  hours = hours * sign;
  minutes = minutes * sign;
  seconds = seconds * sign;
  milliseconds = milliseconds * sign;
  microseconds = microseconds * sign;
  nanoseconds = nanoseconds * sign;
  const dur = new Duration(
    0,
    0,
    0,
    days,
    hours,
    minutes,
    seconds
  );
  dur.milliseconds = milliseconds;
  dur.microseconds = microseconds;
  dur.nanoseconds = nanoseconds;
  return dur;
}