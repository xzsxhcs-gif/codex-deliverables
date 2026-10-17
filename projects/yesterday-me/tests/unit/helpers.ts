import 'fake-indexeddb/auto';
import { afterEach, beforeEach } from 'vitest';
import { CapsuleRepository } from '../../src/domain/repository';
import type { Backup, CapsuleRecord, Outcome, Prediction, SealInput } from '../../src/domain/types';

let databaseSequence = 0;
const repositories: CapsuleRepository[] = [];
const originalTimeZone = process.env.TZ;

beforeEach(() => { process.env.TZ = 'Asia/Shanghai'; });
afterEach(() => {
  for (const repository of repositories.splice(0)) repository.close();
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

export const evidence: SealInput = {
  title: '一份明日再看的记录',
  content: '今天决定好好休息。明天记得对自己温柔一点。',
  defense: '休息也是正经事。',
  prediction: 'forgive',
};

export function repositoryAt(initial = '2026-10-17T12:00:00+08:00', existingName?: string) {
  let current = new Date(initial);
  let sequence = 0;
  const dbName = existingName ?? `yesterday-test-${++databaseSequence}`;
  const repository = new CapsuleRepository({
    dbName,
    now: () => new Date(current),
    id: () => `${dbName}-capsule-${++sequence}`,
  });
  repositories.push(repository);
  return {
    repository,
    dbName,
    setTime: (value: string) => { current = new Date(value); },
  };
}

export function record(number: number, options: {
  sealedDate?: string;
  judgedDate?: string;
  prediction?: Prediction;
  outcome?: Outcome;
  caseNumber?: number;
} = {}): CapsuleRecord {
  const sealedDate = options.sealedDate ?? '2026-10-16';
  const midnight = new Date(`${sealedDate}T00:00:00+08:00`);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  const unlockDate = new Date(midnight.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
  const judgedDate = options.judgedDate ?? unlockDate;
  const prediction = options.prediction ?? 'forgive';
  return {
    ...evidence,
    prediction,
    id: `record-${number}`,
    caseNumber: options.caseNumber ?? number,
    sealedAt: new Date(`${sealedDate}T12:00:00+08:00`).getTime(),
    sealedDate,
    unlockDate,
    sealedTimeZone: 'Asia/Shanghai',
    verdict: options.outcome ? {
      outcome: options.outcome,
      judgedAt: new Date(`${judgedDate}T13:00:00+08:00`).getTime(),
      judgedDate,
      predictionMatched: prediction === 'unsure' ? null : prediction === options.outcome,
    } : null,
  };
}

export function backup(capsules: CapsuleRecord[]): Backup {
  return {
    app: 'yesterday-me',
    version: 1,
    exportedAt: '2026-10-17T06:00:00.000Z',
    capsules,
  };
}
