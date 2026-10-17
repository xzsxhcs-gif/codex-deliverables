import { describe, expect, it } from 'vitest';
import type { Backup } from '../../src/domain/types';
import { backup, evidence, record, repositoryAt } from './helpers';

describe('可移植备份、严格校验与合并', () => {
  it('导出的 JSON 包含必要数据，导入另一数据库保留原文、预测和不可变判决', async () => {
    const source = repositoryAt();
    const sealed = await source.repository.seal({ ...evidence, prediction: 'hiss' });
    source.setTime('2026-10-18T10:00:00+08:00');
    const original = await source.repository.judge(sealed.id, 'forgive');
    const exported = await source.repository.exportBackup();
    expect(exported).toMatchObject({ app: 'yesterday-me', version: 1 });
    expect(Number.isNaN(Date.parse(exported.exportedAt))).toBe(false);
    const destination = repositoryAt('2026-10-20T10:00:00+08:00');
    expect(await destination.repository.importBackup(JSON.stringify(exported))).toEqual({ added: 1, skipped: 0, conflicts: 0 });
    expect(await destination.repository.open(sealed.id)).toEqual(original);
    await expect(destination.repository.judge(sealed.id, 'hiss')).rejects.toMatchObject({ code: 'ALREADY_JUDGED' });
  });

  it('同一备份重复导入不重复记录，相同 id 的冲突不覆盖本机判决', async () => {
    const { repository } = repositoryAt();
    const original = record(1, { outcome: 'forgive' });
    const raw = JSON.stringify(backup([original]));
    expect(await repository.importBackup(raw)).toEqual({ added: 1, skipped: 0, conflicts: 0 });
    expect(await repository.importBackup(raw)).toEqual({ added: 0, skipped: 1, conflicts: 0 });
    const conflicting = record(1, { outcome: 'hiss' });
    expect(await repository.importBackup(JSON.stringify(backup([conflicting])))).toEqual({ added: 0, skipped: 0, conflicts: 1 });
    expect((await repository.open(original.id)).verdict?.outcome).toBe('forgive');
    expect(await repository.list()).toHaveLength(1);
  });

  it('不同 id 使用相同案件编号时重新分配，重新导入原备份仍视为重复', async () => {
    const { repository } = repositoryAt();
    const a = record(1, { caseNumber: 7 });
    const b = record(2, { caseNumber: 7 });
    await repository.importBackup(JSON.stringify(backup([a])));
    const rawB = JSON.stringify(backup([b]));
    expect(await repository.importBackup(rawB)).toEqual({ added: 1, skipped: 0, conflicts: 0 });
    const items = await repository.list();
    expect(new Set(items.map(item => item.caseNumber)).size).toBe(2);
    expect(await repository.importBackup(rawB)).toEqual({ added: 0, skipped: 1, conflicts: 0 });
    const next = await repository.seal(evidence);
    expect(items.map(item => item.caseNumber)).not.toContain(next.caseNumber);
  });

  it('整批数据先验证：后面的无效记录不能导致前面的有效记录部分写入', async () => {
    const { repository } = repositoryAt();
    const existing = await repository.seal(evidence);
    const invalid = { ...record(2), unlockDate: 'not-a-date' };
    await expect(repository.importBackup(JSON.stringify(backup([record(1), invalid])))).rejects.toMatchObject({ code: 'INVALID_BACKUP' });
    expect((await repository.list()).map(item => item.id)).toEqual([existing.id]);
  });

  const malformed: [string, (value: Backup) => unknown][] = [
    ['应用标识错误', value => ({ ...value, app: 'other-app' })],
    ['未知版本', value => ({ ...value, version: 2 })],
    ['导出时间无效', value => ({ ...value, exportedAt: 'tomorrow' })],
    ['导出日期不能自动归一化', value => ({ ...value, exportedAt: '2026-02-30T06:00:00.000Z' })],
    ['导出时间不能将24点归一化到次日', value => ({ ...value, exportedAt: '2026-10-17T24:00:00.000Z' })],
    ['字段类型错误', value => ({ ...value, capsules: {} })],
    ['多余顶层字段', value => ({ ...value, secret: true })],
    ['缺少预测', value => { delete (value.capsules[0] as Partial<typeof value.capsules[0]>).prediction; return value; }],
    ['多余记录字段', value => { Object.assign(value.capsules[0], { hidden: true }); return value; }],
    ['无效预测', value => { Object.assign(value.capsules[0], { prediction: 'unknown' }); return value; }],
    ['空正文', value => { value.capsules[0].content = ''; return value; }],
    ['不存在的日期', value => { value.capsules[0].sealedDate = '2026-02-30'; return value; }],
    ['解锁日与封存日不一致', value => { value.capsules[0].unlockDate = '2026-10-19'; return value; }],
    ['封存日期与原始时区时间戳不一致', value => { value.capsules[0].sealedAt += 86_400_000; return value; }],
    ['负编号', value => { value.capsules[0].caseNumber = -1; return value; }],
    ['非整数编号', value => { value.capsules[0].caseNumber = 1.5; return value; }],
    ['无效时区', value => { value.capsules[0].sealedTimeZone = 'Mars/Olympus'; return value; }],
    ['判决预测结果不一致', value => { value.capsules[0] = record(1, { outcome: 'forgive' }); value.capsules[0].verdict!.predictionMatched = false; return value; }],
    ['解锁前判决', value => { value.capsules[0] = record(1, { outcome: 'hiss', judgedDate: '2026-10-16' }); return value; }],
    ['未知判决字段', value => { value.capsules[0] = record(1, { outcome: 'hiss' }); Object.assign(value.capsules[0].verdict!, { amended: true }); return value; }],
  ];

  it.each(malformed)('拒绝损坏或不符合格式的备份：%s', async (_name, damage) => {
    const { repository } = repositoryAt();
    await expect(repository.importBackup(JSON.stringify(damage(backup([record(1)]))))).rejects.toMatchObject({ code: 'INVALID_BACKUP' });
    expect(await repository.list()).toEqual([]);
  });

  it('非法 JSON 与 JSON null 返回统一、可展示的格式错误', async () => {
    const { repository } = repositoryAt();
    for (const raw of ['{ broken', 'null', '[]', '42', '']) {
      await expect(repository.importBackup(raw)).rejects.toMatchObject({ code: 'INVALID_BACKUP' });
    }
  });

  it('拒绝超过 10 MB 的输入，不进行部分导入', async () => {
    const { repository } = repositoryAt();
    const oversized = JSON.stringify(backup([])) + ' '.repeat(11 * 1024 * 1024);
    await expect(repository.importBackup(oversized)).rejects.toMatchObject({ code: 'INVALID_BACKUP' });
    expect(await repository.list()).toEqual([]);
  });

  it('拒绝超过 10000 条记录的批次', async () => {
    const { repository } = repositoryAt();
    const oversized = backup(Array.from({ length: 10001 }, (_, index) => record(index + 1)));
    await expect(repository.importBackup(JSON.stringify(oversized))).rejects.toMatchObject({ code: 'INVALID_BACKUP' });
    expect(await repository.list()).toEqual([]);
  });

  it('同一批次出现重复证据 id 时整体拒绝，不能以最后一条覆盖第一条', async () => {
    const { repository } = repositoryAt();
    const first = record(1);
    const duplicate = { ...first, content: '试图替换原始内容' };
    await expect(repository.importBackup(JSON.stringify(backup([first, duplicate])))).rejects.toMatchObject({ code: 'INVALID_BACKUP' });
    expect(await repository.list()).toEqual([]);
  });

  it('同一批次存在不同 id 的编号碰撞时完整导入且保持编号唯一', async () => {
    const { repository } = repositoryAt();
    const values = [record(1, { caseNumber: 1 }), record(2, { caseNumber: 1 }), record(3, { caseNumber: 2 })];
    expect(await repository.importBackup(JSON.stringify(backup(values)))).toEqual({ added: 3, skipped: 0, conflicts: 0 });
    const numbers = (await repository.list()).map(item => item.caseNumber);
    expect(new Set(numbers).size).toBe(3);
  });

  it('在其他时区导入仍根据封存记录的时区校验历史日期', async () => {
    const { repository } = repositoryAt();
    const original = record(1);
    // 00:15 in Shanghai is the previous day in Los Angeles.
    original.sealedAt = new Date('2026-10-16T00:15:00+08:00').getTime();
    process.env.TZ = 'America/Los_Angeles';
    expect(await repository.importBackup(JSON.stringify(backup([original])))).toEqual({ added: 1, skipped: 0, conflicts: 0 });
    expect((await repository.exportBackup()).capsules[0].sealedDate).toBe('2026-10-16');
  });
});
