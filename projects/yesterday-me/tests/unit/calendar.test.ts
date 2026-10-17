import { afterEach, describe, expect, it } from 'vitest';
import { isUnlocked, localDate, nextLocalDate, nextMidnight } from '../../src/domain/calendar';

const originalTimeZone = process.env.TZ;
afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe('当地日历与解锁边界', () => {
  it('使用当地日期，而不是 UTC 截取的日期', () => {
    process.env.TZ = 'Asia/Shanghai';
    expect(localDate(new Date('2026-12-31T16:30:00Z'))).toBe('2027-01-01');
  });

  it.each([
    ['2026-12-31', '2027-01-01'],
    ['2026-10-31', '2026-11-01'],
    ['2028-02-28', '2028-02-29'],
    ['2028-02-29', '2028-03-01'],
    ['2027-02-28', '2027-03-01'],
  ])('跨月、跨年和闰日：%s → %s', (today, tomorrow) => {
    process.env.TZ = 'Asia/Shanghai';
    expect(nextLocalDate(new Date(`${today}T19:42:00+08:00`))).toBe(tomorrow);
  });

  it('当地午夜前 1 毫秒仍锁定，午夜起可打开，之后持续可打开', () => {
    process.env.TZ = 'Asia/Shanghai';
    const before = new Date('2026-10-17T23:59:59.999+08:00');
    expect(nextMidnight(before).getTime() - before.getTime()).toBe(1);
    expect(isUnlocked('2026-10-18', before)).toBe(false);
    expect(isUnlocked('2026-10-18', new Date('2026-10-18T00:00:00+08:00'))).toBe(true);
    expect(isUnlocked('2026-10-18', new Date('2027-01-01T00:00:00+08:00'))).toBe(true);
  });

  it.each([
    ['2026-03-08T00:00:00-05:00', '2026-03-09', 23],
    ['2026-11-01T00:00:00-04:00', '2026-11-02', 25],
  ])('夏令时切换日按日历午夜计算，不强制 24 小时：%s', (instant, date, hours) => {
    process.env.TZ = 'America/New_York';
    const start = new Date(instant);
    const midnight = nextMidnight(start);
    expect(localDate(midnight)).toBe(date);
    expect(midnight.getHours()).toBe(0);
    expect(midnight.getTime() - start.getTime()).toBe(hours * 3_600_000);
  });

  it('旅行后以设备当前当地日期判断，不把封存时区强行固定为计时器', () => {
    const instant = new Date('2026-10-17T16:30:00Z');
    process.env.TZ = 'Asia/Shanghai';
    expect(isUnlocked('2026-10-18', instant)).toBe(true);
    process.env.TZ = 'America/Los_Angeles';
    expect(localDate(instant)).toBe('2026-10-17');
    expect(isUnlocked('2026-10-18', instant)).toBe(false);
  });
});
