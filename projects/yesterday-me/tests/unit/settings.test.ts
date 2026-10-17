import { describe, expect, it } from 'vitest';
import type { AppSettings } from '../../src/domain/types';
import { evidence, repositoryAt } from './helpers';

describe('本地设置与主动清除', () => {
  it('默认深色与首次使用引导；保存部分设置不抹去其他字段', async () => {
    const { repository } = repositoryAt();
    expect(await repository.getSettings()).toEqual({ theme: 'dark', onboardingDone: false });
    await repository.saveSettings({ theme: 'light' });
    expect(await repository.getSettings()).toEqual({ theme: 'light', onboardingDone: false });
    await repository.saveSettings({ onboardingDone: true });
    expect(await repository.getSettings()).toEqual({ theme: 'light', onboardingDone: true });
  });

  it('拒绝无效设置，不污染已保存的有效值', async () => {
    const { repository } = repositoryAt();
    await repository.saveSettings({ theme: 'light' });
    await expect(repository.saveSettings({ theme: 'rainbow' } as unknown as Partial<AppSettings>)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(repository.saveSettings({ onboardingDone: 'yes' } as unknown as Partial<AppSettings>)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(await repository.getSettings()).toEqual({ theme: 'light', onboardingDone: false });
  });

  it('清空后记录、统计和设置复位，刷新后仍为空，之后仍可正常封存', async () => {
    const { repository, setTime, dbName } = repositoryAt();
    const sealed = await repository.seal(evidence);
    setTime('2026-10-18T12:00:00+08:00');
    await repository.judge(sealed.id, 'forgive');
    await repository.saveSettings({ theme: 'light', onboardingDone: true });
    await repository.clearAll();
    expect(await repository.list()).toEqual([]);
    expect(await repository.getSettings()).toEqual({ theme: 'dark', onboardingDone: false });
    expect(await repository.stats()).toMatchObject({ sealedTotal: 0, trialsTotal: 0, accuracy: null });
    repository.close();
    const reopened = repositoryAt('2026-10-18T12:00:00+08:00', dbName).repository;
    expect(await reopened.list()).toEqual([]);
    const newEvidence = await reopened.seal(evidence);
    expect(newEvidence.caseNumber).toBe(1);
    expect(newEvidence.status).toBe('sealed');
  });
});
