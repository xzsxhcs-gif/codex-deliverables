import { shiftDateKey, validDateKey } from './calendar';
import { DomainError } from './errors';
import type { Backup, CapsuleRecord, Outcome, Prediction, SealInput } from './types';

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const MAX_BACKUP_RECORDS = 10_000;
const predictions = new Set<Prediction>(['forgive', 'hiss', 'unsure']);
const outcomes = new Set<Outcome>(['forgive', 'hiss']);

function fail(message: string): never {
  throw new DomainError('INVALID_BACKUP', `备份无法导入：${message}`);
}

function object(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label}格式不正确。`);
  const item = value as Record<string, unknown>;
  const found = Object.keys(item);
  if (found.length !== keys.length || found.some(key => !keys.includes(key))) fail(`${label}的字段不完整或包含未知字段。`);
  return item;
}

function text(value: unknown, max: number, label: string, required = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`${label}为空或超出长度限制。`);
}

function timestamp(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 253402300799999) fail(`${label}无效。`);
}

function dateInZone(value: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const part = (name: string) => parts.find(item => item.type === name)?.value;
  return `${part('year')?.padStart(4, '0')}-${part('month')}-${part('day')}`;
}

function validateRecord(raw: unknown): CapsuleRecord {
  const value = object(raw, ['id', 'caseNumber', 'title', 'content', 'defense', 'prediction', 'sealedAt', 'sealedDate', 'unlockDate', 'sealedTimeZone', 'verdict'], '证据记录');
  text(value.id, 200, '证据编号', true);
  if (!Number.isSafeInteger(value.caseNumber) || (value.caseNumber as number) < 1 || (value.caseNumber as number) >= Number.MAX_SAFE_INTEGER) fail('案件序号无效。');
  text(value.title, 60, '标题', true);
  text(value.content, 5000, '留言', true);
  text(value.defense, 1000, '辩护词');
  if (!predictions.has(value.prediction as Prediction)) fail('预测选项无效。');
  timestamp(value.sealedAt, '封存时间');
  if (!validDateKey(value.sealedDate) || !validDateKey(value.unlockDate)) fail('封存或解锁日期无效。');
  if (shiftDateKey(value.sealedDate, 1) !== value.unlockDate) fail('解锁日期必须是封存日期的次日。');
  text(value.sealedTimeZone, 100, '封存时区', true);
  try {
    if (dateInZone(value.sealedAt, value.sealedTimeZone) !== value.sealedDate) fail('封存日期与时间、时区不一致。');
  } catch (error) {
    if (error instanceof DomainError) throw error;
    fail('封存时区无效。');
  }
  if (value.verdict !== null) {
    const verdict = object(value.verdict, ['outcome', 'judgedAt', 'judgedDate', 'predictionMatched'], '判决');
    if (!outcomes.has(verdict.outcome as Outcome)) fail('判决选项无效。');
    timestamp(verdict.judgedAt, '判决时间');
    if (!validDateKey(verdict.judgedDate) || verdict.judgedDate < value.unlockDate || verdict.judgedAt < value.sealedAt) fail('判决发生在解锁前。');
    const utcDate = new Date(verdict.judgedAt).toISOString().slice(0, 10);
    // The traveller's time zone may differ from the sealing zone, but cannot be days away from UTC.
    if (verdict.judgedDate < shiftDateKey(utcDate, -1) || verdict.judgedDate > shiftDateKey(utcDate, 1)) fail('判决日期与时间不一致。');
    const expected = value.prediction === 'unsure' ? null : value.prediction === verdict.outcome;
    if (verdict.predictionMatched !== expected) fail('预测结果与判决不一致。');
  }
  return value as unknown as CapsuleRecord;
}

export function parseBackup(raw: string): Backup {
  if (typeof raw !== 'string' || raw.length > MAX_BACKUP_BYTES || new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) fail('文件超过 10 MB。');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { fail('不是有效的 JSON 文件。'); }
  const value = object(parsed, ['app', 'version', 'exportedAt', 'capsules'], '备份文件');
  if (value.app !== 'yesterday-me' || value.version !== 1) fail('不是受支持的《昨日的我》备份版本。');
  if (typeof value.exportedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(value.exportedAt)
      || !validDateKey(value.exportedAt.slice(0, 10)) || !Number.isFinite(Date.parse(value.exportedAt))) fail('导出时间无效。');
  if (!Array.isArray(value.capsules) || value.capsules.length > MAX_BACKUP_RECORDS) fail('记录数量超过 10000 条或格式不正确。');
  const ids = new Set<string>();
  const capsules = value.capsules.map(rawRecord => {
    const record = validateRecord(rawRecord);
    if (ids.has(record.id)) fail('文件中存在重复的证据编号。');
    ids.add(record.id);
    return record;
  });
  return { app: 'yesterday-me', version: 1, exportedAt: value.exportedAt, capsules };
}

/** Case numbers may be reassigned during a merge; all evidence and verdict fields must match. */
export function sameEvidence(a: CapsuleRecord, b: CapsuleRecord): boolean {
  const tuple = (item: CapsuleRecord) => [item.id, item.title, item.content, item.defense, item.prediction,
    item.sealedAt, item.sealedDate, item.unlockDate, item.sealedTimeZone,
    item.verdict && [item.verdict.outcome, item.verdict.judgedAt, item.verdict.judgedDate, item.verdict.predictionMatched]];
  return JSON.stringify(tuple(a)) === JSON.stringify(tuple(b));
}

export function validateSealInput(input: SealInput): SealInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || typeof input.title !== 'string' || input.title.length > 60
      || typeof input.content !== 'string' || !input.content.trim() || input.content.length > 5000
      || typeof input.defense !== 'string' || input.defense.length > 1000
      || !predictions.has(input.prediction)) {
    throw new DomainError('INVALID_INPUT', '请检查留言长度，并选择对明日判决的预测。');
  }
  return { title: input.title.trim() || '未命名证据', content: input.content.trim(), defense: input.defense.trim(), prediction: input.prediction };
}
