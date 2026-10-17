import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { isUnlocked, localDate, nextLocalDate, validDateKey } from './calendar';
import { parseBackup, sameEvidence, validateSealInput } from './backup';
import { calculateStatistics } from './stats';
import { DomainError } from './errors';
import type { AppSettings, Backup, CapsuleRecord, CapsuleSummary, CaseFile, ImportResult, Outcome, SealInput, Statistics } from './types';

export { DomainError } from './errors';

interface Database extends DBSchema {
  capsules: {
    key: string;
    value: CapsuleRecord;
    indexes: { 'by-case-number': number; 'by-sealed-at': number };
  };
  meta: { key: string; value: { key: string; value: unknown } };
}

const DEFAULT_SETTINGS: AppSettings = { theme: 'dark', onboardingDone: false };
const SEQUENCE_KEY = 'case-sequence';

function summarize(record: CapsuleRecord, now: Date): CapsuleSummary {
  const status = record.verdict ? 'judged' : isUnlocked(record.unlockDate, now) ? 'ready' : 'sealed';
  return {
    id: record.id, caseNumber: record.caseNumber,
    title: status === 'sealed' ? null : record.title,
    sealedAt: record.sealedAt, sealedDate: record.sealedDate, unlockDate: record.unlockDate,
    status, verdict: record.verdict,
  };
}

function opened(record: CapsuleRecord, now: Date): CaseFile {
  const { prediction, verdict, ...evidence } = record;
  if (verdict) return { ...evidence, status: 'judged', prediction, verdict };
  if (!isUnlocked(record.unlockDate, now)) throw new DomainError('LOCKED', '证据尚未解锁。被告暂时安全。');
  return { ...evidence, status: 'ready' };
}

function createId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new DomainError('STORAGE_UNAVAILABLE', '当前浏览器无法生成可靠编号，请使用最新版浏览器或 HTTPS 地址。');
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
}

/** The repository owns all state transitions. Views receive deliberately restricted projections. */
export class CapsuleRepository {
  private connection: Promise<IDBPDatabase<Database>> | undefined;
  private readonly dbName: string;
  private readonly now: () => Date;
  private readonly id: () => string;

  constructor(options: { dbName?: string; now?: () => Date; id?: () => string } = {}) {
    this.dbName = options.dbName ?? 'yesterday-me-v1';
    this.now = options.now ?? (() => new Date());
    this.id = options.id ?? createId;
  }

  private database(): Promise<IDBPDatabase<Database>> {
    if (!this.connection) {
      if (!globalThis.indexedDB) return Promise.reject(new DomainError('STORAGE_UNAVAILABLE', '此浏览器无法使用本地数据库，请检查隐私模式或浏览器设置。'));
      const opening = openDB<Database>(this.dbName, 1, {
        upgrade(db) {
          const capsules = db.createObjectStore('capsules', { keyPath: 'id' });
          capsules.createIndex('by-case-number', 'caseNumber', { unique: true });
          capsules.createIndex('by-sealed-at', 'sealedAt');
          db.createObjectStore('meta', { keyPath: 'key' });
        },
        blocking: () => this.close(),
        terminated: () => { if (this.connection === opening) this.connection = undefined; },
      });
      this.connection = opening;
      void opening.catch(() => { if (this.connection === opening) this.connection = undefined; });
    }
    return this.connection;
  }

  async init(): Promise<void> {
    await this.database();
  }

  close(): void {
    const connection = this.connection;
    this.connection = undefined;
    void connection?.then(db => db.close()).catch(() => undefined);
  }

  async seal(input: SealInput): Promise<CapsuleSummary> {
    const evidence = validateSealInput(input);
    const now = this.now();
    const id = this.id();
    if (typeof id !== 'string' || !id.trim() || id.length > 200 || !Number.isFinite(now.getTime()) || now.getTime() < 0
        || !validDateKey(localDate(now)) || !validDateKey(nextLocalDate(now))) throw new DomainError('INVALID_INPUT', '当前时间或证据编号无效。');
    const db = await this.database();
    const tx = db.transaction(['capsules', 'meta'], 'readwrite');
    void tx.done.catch(() => undefined);
    const capsules = tx.objectStore('capsules');
    const meta = tx.objectStore('meta');
    if (await capsules.get(id)) {
      await tx.done;
      throw new DomainError('INVALID_INPUT', '证据编号重复，请重试。');
    }
    const current = (await meta.get(SEQUENCE_KEY))?.value;
    const caseNumber = (typeof current === 'number' ? current : 0) + 1;
    if (!Number.isSafeInteger(caseNumber) || caseNumber >= Number.MAX_SAFE_INTEGER) {
      await tx.done;
      throw new DomainError('INVALID_INPUT', '案件编号已达到支持上限，请先备份。');
    }
    const record: CapsuleRecord = {
      ...evidence, id, caseNumber, sealedAt: now.getTime(), sealedDate: localDate(now),
      unlockDate: nextLocalDate(now), sealedTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', verdict: null,
    };
    await capsules.add(record);
    await meta.put({ key: SEQUENCE_KEY, value: caseNumber });
    await tx.done;
    return summarize(record, now);
  }

  async list(): Promise<CapsuleSummary[]> {
    const records = await (await this.database()).getAll('capsules');
    const now = this.now();
    return records.sort((a, b) => b.sealedAt - a.sealedAt || b.caseNumber - a.caseNumber).map(record => summarize(record, now));
  }

  async open(id: string): Promise<CaseFile> {
    const record = await (await this.database()).get('capsules', id);
    if (!record) throw new DomainError('NOT_FOUND', '没有找到这份证据，它可能已在其他窗口被删除。');
    return opened(record, this.now());
  }

  async judge(id: string, outcome: Outcome): Promise<CaseFile> {
    if (outcome !== 'forgive' && outcome !== 'hiss') throw new DomainError('INVALID_INPUT', '请选择有效的判决。');
    const db = await this.database();
    // Read and write in one transaction: two tabs cannot judge the same record twice.
    const tx = db.transaction('capsules', 'readwrite');
    void tx.done.catch(() => undefined);
    const record = await tx.store.get(id);
    if (!record) {
      await tx.done;
      throw new DomainError('NOT_FOUND', '没有找到这份证据，它可能已在其他窗口被删除。');
    }
    if (record.verdict) {
      await tx.done;
      throw new DomainError('ALREADY_JUDGED', '本案已有判决。昨天的你已离线，无法接受申诉。');
    }
    const now = this.now();
    if (!isUnlocked(record.unlockDate, now)) {
      await tx.done;
      throw new DomainError('LOCKED', '证据尚未解锁。被告暂时安全。');
    }
    if (now.getTime() < record.sealedAt) {
      await tx.done;
      throw new DomainError('INVALID_INPUT', '设备时间早于封存时间，请检查系统日期。');
    }
    record.verdict = {
      outcome, judgedAt: now.getTime(), judgedDate: localDate(now),
      predictionMatched: record.prediction === 'unsure' ? null : record.prediction === outcome,
    };
    await tx.store.put(record);
    await tx.done;
    return opened(record, now);
  }

  async stats(): Promise<Statistics> {
    return calculateStatistics(await (await this.database()).getAll('capsules'), this.now());
  }

  async exportBackup(): Promise<Backup> {
    const capsules = await (await this.database()).getAll('capsules');
    return { app: 'yesterday-me', version: 1, exportedAt: this.now().toISOString(), capsules: capsules.sort((a, b) => a.caseNumber - b.caseNumber) };
  }

  async importBackup(raw: string): Promise<ImportResult> {
    // Validate every record before starting a transaction, so a malformed batch changes nothing.
    const backup = parseBackup(raw);
    const db = await this.database();
    const tx = db.transaction(['capsules', 'meta'], 'readwrite');
    void tx.done.catch(() => undefined);
    const capsules = tx.objectStore('capsules');
    const meta = tx.objectStore('meta');
    const current = await capsules.getAll();
    const byId = new Map(current.map(record => [record.id, record]));
    const usedNumbers = new Set(current.map(record => record.caseNumber));
    const sequence = (await meta.get(SEQUENCE_KEY))?.value;
    let highest = current.reduce((maximum, record) => Math.max(maximum, record.caseNumber), typeof sequence === 'number' ? sequence : 0);
    const result: ImportResult = { added: 0, skipped: 0, conflicts: 0 };
    const pending: CapsuleRecord[] = [];
    for (const source of backup.capsules) {
      const existing = byId.get(source.id);
      if (existing) {
        if (sameEvidence(existing, source)) result.skipped++;
        else result.conflicts++;
        continue;
      }
      const record = { ...source };
      if (usedNumbers.has(record.caseNumber)) record.caseNumber = highest + 1;
      if (!Number.isSafeInteger(record.caseNumber) || record.caseNumber >= Number.MAX_SAFE_INTEGER) {
        await tx.done;
        throw new DomainError('INVALID_BACKUP', '备份合并后案件编号超过支持上限。');
      }
      usedNumbers.add(record.caseNumber);
      highest = Math.max(highest, record.caseNumber);
      byId.set(record.id, record);
      pending.push(record);
      result.added++;
    }
    for (const record of pending) await capsules.add(record);
    await meta.put({ key: SEQUENCE_KEY, value: highest });
    await tx.done;
    return result;
  }

  async getSettings(): Promise<AppSettings> {
    const stored = (await (await this.database()).get('meta', 'settings'))?.value;
    if (!stored || typeof stored !== 'object') return { ...DEFAULT_SETTINGS };
    const value = stored as Partial<AppSettings>;
    return { theme: value.theme === 'light' ? 'light' : 'dark', onboardingDone: value.onboardingDone === true };
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)
        || Object.keys(settings).some(key => key !== 'theme' && key !== 'onboardingDone')
        || ('theme' in settings && settings.theme !== 'dark' && settings.theme !== 'light')
        || ('onboardingDone' in settings && typeof settings.onboardingDone !== 'boolean')) {
      throw new DomainError('INVALID_INPUT', '设置格式不正确。');
    }
    const tx = (await this.database()).transaction('meta', 'readwrite');
    void tx.done.catch(() => undefined);
    const stored = (await tx.store.get('settings'))?.value;
    const current = stored && typeof stored === 'object' ? stored as AppSettings : DEFAULT_SETTINGS;
    await tx.store.put({ key: 'settings', value: { ...current, ...settings } });
    await tx.done;
  }

  async clearAll(): Promise<void> {
    const tx = (await this.database()).transaction(['capsules', 'meta'], 'readwrite');
    void tx.done.catch(() => undefined);
    await Promise.all([tx.objectStore('capsules').clear(), tx.objectStore('meta').clear()]);
    await tx.done;
  }
}
