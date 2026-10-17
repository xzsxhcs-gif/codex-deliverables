import { localDate, shiftDateKey, weekdayIndex } from './calendar';
import type { CapsuleRecord, Statistics } from './types';

export function calculateStatistics(records: CapsuleRecord[], now: Date): Statistics {
  const result: Statistics = {
    sealedTotal: records.length, trialsTotal: 0, hissTotal: 0, forgiveTotal: 0,
    predictedTotal: 0, correctPredictions: 0, accuracy: null,
    forgiveStreak: 0, monthlyHiss: 0, weekdayCounts: Array<number>(7).fill(0), busiestWeekdays: [],
  };
  const days = new Map<string, { forgive: boolean; hiss: boolean }>();
  const today = localDate(now);
  for (const record of records) {
    const verdict = record.verdict;
    if (!verdict) continue;
    result.trialsTotal++;
    result.weekdayCounts[weekdayIndex(verdict.judgedDate)]!++;
    const day = days.get(verdict.judgedDate) ?? { forgive: false, hiss: false };
    day[verdict.outcome] = true;
    days.set(verdict.judgedDate, day);
    if (verdict.outcome === 'hiss') {
      result.hissTotal++;
      if (verdict.judgedDate.slice(0, 7) === today.slice(0, 7)) result.monthlyHiss++;
    } else {
      result.forgiveTotal++;
    }
    if (record.prediction !== 'unsure') {
      result.predictedTotal++;
      if (record.prediction === verdict.outcome) result.correctPredictions++;
    }
  }
  if (result.predictedTotal) result.accuracy = (result.correctPredictions / result.predictedTotal) * 100;
  const highest = Math.max(...result.weekdayCounts);
  if (highest) result.busiestWeekdays = result.weekdayCounts.flatMap((count, index) => count === highest ? [index] : []);

  // An untouched today does not erase yesterday's streak. A hiss does.
  let cursor = days.has(today) ? today : shiftDateKey(today, -1);
  while (days.get(cursor)?.forgive && !days.get(cursor)?.hiss) {
    result.forgiveStreak++;
    cursor = shiftDateKey(cursor, -1);
  }
  return result;
}
