/** Stored dates are civil dates. They deliberately follow the device's current time zone. */
export function localDate(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError('无效日期');
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** UTC is only used as a calendar calculator; this is not a 24-hour unlocking rule. */
export function shiftDateKey(value: string, days: number): string {
  if (!validDateKey(value)) throw new RangeError('无效日历日期');
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day + days);
  date.setUTCHours(0, 0, 0, 0);
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function nextLocalDate(date: Date): string {
  return shiftDateKey(localDate(date), 1);
}

export function nextMidnight(date: Date): Date {
  if (!Number.isFinite(date.getTime())) throw new RangeError('无效日期');
  const midnight = new Date(date.getTime());
  // Setting local hours handles daylight saving days with 23 or 25 elapsed hours.
  midnight.setHours(24, 0, 0, 0);
  return midnight;
}

export function isUnlocked(unlockDate: string, now: Date): boolean {
  if (!validDateKey(unlockDate)) return false;
  return localDate(now) >= unlockDate;
}

export function weekdayIndex(value: string): number {
  if (!validDateKey(value)) throw new RangeError('无效日历日期');
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (date.getUTCDay() + 6) % 7;
}
