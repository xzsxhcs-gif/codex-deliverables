import { describe, expect, it } from 'vitest';
import { backup, record, repositoryAt } from './helpers';

describe('统计全部来自真实记录', () => {
  it('空数据库没有虚构示例或除零产生的准确率', async () => {
    const { repository } = repositoryAt();
    expect(await repository.stats()).toEqual({
      sealedTotal: 0, trialsTotal: 0, hissTotal: 0, forgiveTotal: 0,
      predictedTotal: 0, correctPredictions: 0, accuracy: null,
      forgiveStreak: 0, monthlyHiss: 0, weekdayCounts: [0, 0, 0, 0, 0, 0, 0], busiestWeekdays: [],
    });
  });

  it('只给明确预测计分；不好说不算成功，也不算失败', async () => {
    const { repository } = repositoryAt();
    await repository.importBackup(JSON.stringify(backup([
      record(1, { prediction: 'forgive', outcome: 'forgive' }),
      record(2, { prediction: 'hiss', outcome: 'forgive' }),
      record(3, { prediction: 'unsure', outcome: 'hiss' }),
      record(4, { prediction: 'hiss', outcome: 'hiss' }),
      record(5),
    ])));
    const stats = await repository.stats();
    expect(stats).toMatchObject({ sealedTotal: 5, trialsTotal: 4, hissTotal: 2, forgiveTotal: 2, predictedTotal: 3, correctPredictions: 2, monthlyHiss: 2 });
    expect(stats.accuracy).toBeCloseTo(200 / 3, 5);
  });

  it('全部为不确定预测时准确率为空，而不是 0% 或 100%', async () => {
    const { repository } = repositoryAt();
    await repository.importBackup(JSON.stringify(backup([record(1, { prediction: 'unsure', outcome: 'forgive' })])));
    expect(await repository.stats()).toMatchObject({ predictedTotal: 0, correctPredictions: 0, accuracy: null });
  });

  it('同一天多次释放只累计一个连续日，今天未审判时可以从昨天接续', async () => {
    const { repository } = repositoryAt('2026-10-17T15:00:00+08:00');
    await repository.importBackup(JSON.stringify(backup([
      record(1, { sealedDate: '2026-10-13', judgedDate: '2026-10-14', outcome: 'forgive' }),
      record(2, { sealedDate: '2026-10-14', judgedDate: '2026-10-15', outcome: 'forgive' }),
      record(3, { sealedDate: '2026-10-15', judgedDate: '2026-10-16', outcome: 'forgive' }),
      record(4, { sealedDate: '2026-10-15', judgedDate: '2026-10-16', outcome: 'forgive' }),
    ])));
    expect((await repository.stats()).forgiveStreak).toBe(3);
  });

  it('今天同时有释放和哈气时连续释放归零', async () => {
    const { repository } = repositoryAt();
    await repository.importBackup(JSON.stringify(backup([
      record(1, { sealedDate: '2026-10-15', judgedDate: '2026-10-16', outcome: 'forgive' }),
      record(2, { outcome: 'forgive' }),
      record(3, { outcome: 'hiss' }),
    ])));
    expect((await repository.stats()).forgiveStreak).toBe(0);
  });

  it('缺一天或中途哈气都切断连续日期，历史高纪录不冒充当前连续天数', async () => {
    const { repository, setTime } = repositoryAt();
    await repository.importBackup(JSON.stringify(backup([
      record(1, { sealedDate: '2026-10-12', judgedDate: '2026-10-13', outcome: 'forgive' }),
      record(2, { sealedDate: '2026-10-13', judgedDate: '2026-10-14', outcome: 'hiss' }),
      record(3, { sealedDate: '2026-10-14', judgedDate: '2026-10-15', outcome: 'forgive' }),
      record(4, { sealedDate: '2026-10-15', judgedDate: '2026-10-16', outcome: 'forgive' }),
    ])));
    expect((await repository.stats()).forgiveStreak).toBe(2);
    setTime('2026-10-18T12:00:00+08:00');
    expect((await repository.stats()).forgiveStreak).toBe(0);
  });

  it('连续日可以跨年，不以当天时间戳相减判断', async () => {
    const { repository } = repositoryAt('2027-01-02T12:00:00+08:00');
    await repository.importBackup(JSON.stringify(backup([
      record(1, { sealedDate: '2026-12-30', judgedDate: '2026-12-31', outcome: 'forgive' }),
      record(2, { sealedDate: '2026-12-31', judgedDate: '2027-01-01', outcome: 'forgive' }),
      record(3, { sealedDate: '2027-01-01', judgedDate: '2027-01-02', outcome: 'forgive' }),
    ])));
    expect((await repository.stats()).forgiveStreak).toBe(3);
  });

  it('月份与星期按记录的判决日计算；星期一作为索引 0，支持最多日并列', async () => {
    const { repository } = repositoryAt();
    await repository.importBackup(JSON.stringify(backup([
      record(1, { sealedDate: '2026-10-11', judgedDate: '2026-10-12', outcome: 'hiss' }),
      record(2, { sealedDate: '2026-10-11', judgedDate: '2026-10-12', outcome: 'forgive' }),
      record(3, { sealedDate: '2026-10-12', judgedDate: '2026-10-13', outcome: 'hiss' }),
      record(4, { sealedDate: '2026-10-12', judgedDate: '2026-10-13', outcome: 'forgive' }),
      record(5, { sealedDate: '2026-09-29', judgedDate: '2026-09-30', outcome: 'hiss' }),
    ])));
    expect(await repository.stats()).toMatchObject({ monthlyHiss: 2, weekdayCounts: [2, 2, 1, 0, 0, 0, 0], busiestWeekdays: [0, 1] });
    process.env.TZ = 'America/Los_Angeles';
    expect((await repository.stats()).weekdayCounts).toEqual([2, 2, 1, 0, 0, 0, 0]);
  });
});
