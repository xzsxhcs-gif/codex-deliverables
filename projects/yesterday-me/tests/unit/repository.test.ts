import { describe, expect, it } from 'vitest';
import type { Outcome } from '../../src/domain/types';
import { evidence, repositoryAt } from './helpers';

describe('封存、揭晓与不可撤销的判决', () => {
  it('封存立即隐藏内容，当前日期与次日解锁由设备时钟生成', async () => {
    const { repository } = repositoryAt('2026-12-31T23:59:00+08:00');
    const sealed = await repository.seal(evidence);
    expect(sealed).toMatchObject({ title: null, status: 'sealed', sealedDate: '2026-12-31', unlockDate: '2027-01-01' });
    expect(sealed).not.toHaveProperty('content');
    expect(sealed).not.toHaveProperty('defense');
    expect(sealed).not.toHaveProperty('prediction');
    expect(await repository.list()).toEqual([sealed]);
    await expect(repository.open(sealed.id)).rejects.toMatchObject({ code: 'LOCKED' });
    await expect(repository.judge(sealed.id, 'forgive')).rejects.toMatchObject({ code: 'LOCKED' });
    expect((await repository.exportBackup()).capsules[0].sealedTimeZone).toBe('Asia/Shanghai');
  });

  it('午夜前不能读，午夜揭晓原文与辩护，审判前仍隐藏预测', async () => {
    const { repository, setTime } = repositoryAt();
    const sealed = await repository.seal(evidence);
    setTime('2026-10-17T23:59:59.999+08:00');
    await expect(repository.open(sealed.id)).rejects.toMatchObject({ code: 'LOCKED' });
    setTime('2026-10-18T00:00:00+08:00');
    const opened = await repository.open(sealed.id);
    expect(opened).toMatchObject({ title: evidence.title, content: evidence.content, defense: evidence.defense, status: 'ready' });
    expect(opened).not.toHaveProperty('prediction');
    expect(opened).not.toHaveProperty('verdict');
    expect((await repository.list())[0]).toMatchObject({ status: 'ready', title: evidence.title });
  });

  it('错过次日之后仍可审判，记录判决日期与预测成功结果', async () => {
    const { repository, setTime } = repositoryAt();
    const sealed = await repository.seal(evidence);
    setTime('2026-11-05T12:34:56+08:00');
    const judged = await repository.judge(sealed.id, 'forgive');
    expect(judged).toMatchObject({ status: 'judged', prediction: 'forgive', verdict: { outcome: 'forgive', judgedDate: '2026-11-05', predictionMatched: true } });
    expect(await repository.open(sealed.id)).toEqual(judged);
    await expect(repository.judge(sealed.id, 'hiss')).rejects.toMatchObject({ code: 'ALREADY_JUDGED' });
    expect(await repository.open(sealed.id)).toEqual(judged);
  });

  it('预测失败与“不好说”分别记录为 false 和 null', async () => {
    const { repository, setTime } = repositoryAt();
    const certain = await repository.seal({ ...evidence, prediction: 'hiss' });
    const unsure = await repository.seal({ ...evidence, prediction: 'unsure' });
    setTime('2026-10-18T09:00:00+08:00');
    expect((await repository.judge(certain.id, 'forgive')).verdict?.predictionMatched).toBe(false);
    expect((await repository.judge(unsure.id, 'hiss')).verdict?.predictionMatched).toBeNull();
  });

  it('同一数据库的多个实例同时封存获得不同案件编号，不丢记录', async () => {
    const first = repositoryAt();
    const second = repositoryAt('2026-10-17T12:00:00+08:00', first.dbName);
    // Independent generators emulate two browser tabs; same database transactions serialize case numbers.
    const { CapsuleRepository } = await import('../../src/domain/repository');
    let id = 0;
    const tab = new CapsuleRepository({ dbName: first.dbName, now: () => new Date('2026-10-17T12:00:00+08:00'), id: () => `second-tab-${++id}` });
    try {
      const records = await Promise.all(Array.from({ length: 20 }, (_, index) =>
        (index % 2 ? tab : first.repository).seal({ ...evidence, title: `第 ${index} 份` })));
      expect(new Set(records.map(item => item.id)).size).toBe(20);
      expect(new Set(records.map(item => item.caseNumber)).size).toBe(20);
      expect(await second.repository.list()).toHaveLength(20);
    } finally { tab.close(); }
  });

  it('并发提交两次不同判决只允许一个提交成功，档案保持首次结果', async () => {
    const { repository, setTime, dbName } = repositoryAt();
    const sealed = await repository.seal(evidence);
    setTime('2026-10-18T10:00:00+08:00');
    const otherTab = repositoryAt('2026-10-18T10:00:00+08:00', dbName).repository;
    const results = await Promise.allSettled([repository.judge(sealed.id, 'forgive'), otherTab.judge(sealed.id, 'hiss')]);
    const successes = results.filter(result => result.status === 'fulfilled');
    const failures = results.filter(result => result.status === 'rejected');
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ reason: { code: 'ALREADY_JUDGED' } });
    if (successes[0].status === 'fulfilled') expect(await repository.open(sealed.id)).toEqual(successes[0].value);
    expect((await repository.stats()).trialsTotal).toBe(1);
  });

  it('关闭连接再重新创建实例，封存、判决和设置仍存在', async () => {
    const first = repositoryAt();
    await Promise.all([first.repository.init(), first.repository.init()]);
    const sealed = await first.repository.seal(evidence);
    await first.repository.saveSettings({ theme: 'light', onboardingDone: true });
    first.setTime('2026-10-18T14:00:00+08:00');
    const judged = await first.repository.judge(sealed.id, 'hiss');
    first.repository.close();
    const reopened = repositoryAt('2026-10-20T08:00:00+08:00', first.dbName).repository;
    expect(await reopened.open(sealed.id)).toEqual(judged);
    expect(await reopened.getSettings()).toEqual({ theme: 'light', onboardingDone: true });
    expect((await reopened.list())[0].status).toBe('judged');
  });

  it('没有标题时使用默认标题，但没有正文不能封存', async () => {
    const { repository, setTime } = repositoryAt();
    const sealed = await repository.seal({ ...evidence, title: '   ' });
    await expect(repository.seal({ ...evidence, content: ' \n\t' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    setTime('2026-10-18T12:00:00+08:00');
    expect((await repository.open(sealed.id)).title).toBe('未命名证据');
  });

  it.each([
    ['标题超长', { title: '字'.repeat(61) }],
    ['正文超长', { content: '字'.repeat(5001) }],
    ['辩护超长', { defense: '字'.repeat(1001) }],
    ['无效预测', { prediction: 'other' }],
  ] as const)('拒绝超长或无效字段，失败不生成记录：%s', async (_label, invalid) => {
    const { repository } = repositoryAt();
    await expect(repository.seal({ ...evidence, ...invalid } as typeof evidence)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(await repository.list()).toEqual([]);
  });

  it('允许规定的最大长度，不会错误截断有效文字', async () => {
    const { repository, setTime } = repositoryAt();
    const valid = { ...evidence, title: '字'.repeat(60), content: '字'.repeat(5000), defense: '字'.repeat(1000) };
    const sealed = await repository.seal(valid);
    setTime('2026-10-18T12:00:00+08:00');
    expect(await repository.open(sealed.id)).toMatchObject({ title: valid.title, content: valid.content, defense: valid.defense });
  });

  it('跨时区旅行可以按新当地日期揭晓，不强制等待 24 个小时', async () => {
    process.env.TZ = 'America/Los_Angeles';
    const { repository, setTime } = repositoryAt('2026-10-17T23:50:00-07:00');
    const sealed = await repository.seal(evidence);
    expect(sealed.unlockDate).toBe('2026-10-18');
    process.env.TZ = 'Asia/Shanghai';
    setTime('2026-10-18T14:51:00+08:00');
    expect((await repository.judge(sealed.id, 'forgive')).verdict?.judgedDate).toBe('2026-10-18');
  });

  it('设备时间倒退到封存之前时拒绝判决，避免生成无法导入的矛盾记录', async () => {
    process.env.TZ = 'America/Los_Angeles';
    const { repository, setTime } = repositoryAt('2026-10-17T23:50:00-07:00');
    const sealed = await repository.seal(evidence);
    process.env.TZ = 'Asia/Shanghai';
    setTime('2026-10-18T14:40:00+08:00');
    await expect(repository.judge(sealed.id, 'hiss')).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect((await repository.exportBackup()).capsules[0].verdict).toBeNull();
  });

  it('无效判决和不存在的编号返回可处理错误，不产生档案', async () => {
    const { repository, setTime } = repositoryAt();
    const sealed = await repository.seal(evidence);
    setTime('2026-10-18T12:00:00+08:00');
    await expect(repository.judge(sealed.id, 'delete' as Outcome)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(repository.open('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(repository.judge('missing', 'hiss')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await repository.list())[0].status).toBe('ready');
  });
});
