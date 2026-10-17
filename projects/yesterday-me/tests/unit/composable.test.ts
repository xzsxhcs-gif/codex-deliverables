import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, CapsuleSummary, Statistics } from '../../src/domain/types';

const io = vi.hoisted(() => ({
  init: vi.fn(), close: vi.fn(), list: vi.fn(), stats: vi.fn(), getSettings: vi.fn(), notifyOtherTabs: vi.fn(),
}));

vi.mock('../../src/domain/repository', () => ({
  CapsuleRepository: class {
    init = io.init;
    close = io.close;
    list = io.list;
    stats = io.stats;
    getSettings = io.getSettings;
  },
}));
vi.mock('vue', async importOriginal => {
  const vue = await importOriginal<typeof import('vue')>();
  return { ...vue, onMounted: vi.fn(), onBeforeUnmount: vi.fn() };
});

import { useCapsules } from '../../src/composables/useCapsules';

const settings: AppSettings = { theme: 'dark', onboardingDone: true };
const statistics: Statistics = {
  sealedTotal: 0, trialsTotal: 0, hissTotal: 0, forgiveTotal: 0,
  predictedTotal: 0, correctPredictions: 0, accuracy: null,
  forgiveStreak: 0, monthlyHiss: 0, weekdayCounts: [0, 0, 0, 0, 0, 0, 0], busiestWeekdays: [],
};
function summary(id: string, caseNumber: number): CapsuleSummary {
  return { id, caseNumber, title: null, sealedAt: 1_792_209_600_000, sealedDate: '2026-10-17', unlockDate: '2026-10-18', status: 'sealed', verdict: null };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', { setItem: io.notifyOtherTabs });
  io.init.mockResolvedValue(undefined);
  io.list.mockResolvedValue([]);
  io.stats.mockResolvedValue(statistics);
  io.getSettings.mockResolvedValue(settings);
});

afterEach(() => vi.unstubAllGlobals());

describe('界面状态与已提交事务的边界', () => {
  it('提交成功后即使重新读取失败，也返回已保存结果，避免重复提交证据', async () => {
    const app = useCapsules();
    await app.initialize();
    const saved = summary('saved-evidence', 1);
    io.list.mockRejectedValueOnce(new Error('模拟：读取暂时失败'));
    const operation = vi.fn().mockResolvedValue(saved);
    await expect(app.mutate(operation)).resolves.toEqual(saved);
    expect(operation).toHaveBeenCalledOnce();
    expect(io.notifyOtherTabs).toHaveBeenCalledWith('yesterday-me:refresh', expect.any(String));
    expect(app.error.value).toContain('操作已完成并写入本机');
    expect(app.error.value).toContain('不必重复提交');
    expect(app.busy.value).toBe(false);
    expect(app.ready.value).toBe(true);
  });

  it('实际写入失败仍报错，释放忙碌状态，保留当前已加载数据', async () => {
    const app = useCapsules();
    const existing = summary('existing-evidence', 1);
    io.list.mockResolvedValueOnce([existing]);
    await app.initialize();
    io.list.mockClear();
    const failure = new DOMException('模拟：存储空间不足', 'QuotaExceededError');
    await expect(app.mutate(async () => { throw failure; })).rejects.toBe(failure);
    expect(app.items.value).toEqual([existing]);
    expect(io.list).not.toHaveBeenCalled();
    expect(io.notifyOtherTabs).not.toHaveBeenCalled();
    expect(app.busy.value).toBe(false);
  });

  it('界面同时提交两次操作时第二次不执行，第一次结束后恢复操作能力', async () => {
    const app = useCapsules();
    const firstWrite = deferred<string>();
    const first = app.mutate(() => firstWrite.promise);
    const duplicate = vi.fn().mockResolvedValue('不应被执行');
    await expect(app.mutate(duplicate)).rejects.toThrow();
    expect(duplicate).not.toHaveBeenCalled();
    expect(app.busy.value).toBe(true);
    firstWrite.resolve('已提交');
    await expect(first).resolves.toBe('已提交');
    expect(app.busy.value).toBe(false);
    await expect(app.mutate(async () => '下一笔')).resolves.toBe('下一笔');
  });

  it('较旧的异步读取最后返回时，不覆盖新一次读取的档案', async () => {
    const app = useCapsules();
    const oldRead = deferred<CapsuleSummary[]>();
    const oldItem = summary('old-evidence', 1);
    const newItem = summary('new-evidence', 2);
    io.list.mockImplementationOnce(() => oldRead.promise).mockResolvedValueOnce([newItem]);
    const first = app.refresh();
    await app.refresh();
    expect(app.items.value).toEqual([newItem]);
    oldRead.resolve([oldItem]);
    await first;
    expect(app.items.value).toEqual([newItem]);
  });
});
