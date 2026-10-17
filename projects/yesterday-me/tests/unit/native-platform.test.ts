import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ enabled: true, save: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.enabled },
  registerPlugin: () => ({ save: native.save }),
}));

beforeEach(() => { vi.resetModules(); native.enabled = true; native.save.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Android / 浏览器备份适配', () => {
  it('原生只调用系统文档保存插件，不创建浏览器 blob 链接', async () => {
    native.save.mockResolvedValue({ saved: true });
    const { saveBackupFile } = await import('../../src/native/platform');
    expect(await saveBackupFile('yesterday-me-1.json', '{"中文":"昨日"}')).toBe(true);
    expect(native.save).toHaveBeenCalledWith({ filename: 'yesterday-me-1.json', json: '{"中文":"昨日"}' });
  });
  it('用户取消原生保存返回 false，不伪报保存成功', async () => {
    native.save.mockResolvedValue({ saved: false });
    const { saveBackupFile } = await import('../../src/native/platform');
    expect(await saveBackupFile('yesterday-me-1.json', '{}')).toBe(false);
  });
  it('原生写入错误传递给界面，不回退到无效的 WebView 下载', async () => {
    native.save.mockRejectedValue(new Error('WRITE_FAILED'));
    const { saveBackupFile } = await import('../../src/native/platform');
    await expect(saveBackupFile('yesterday-me-1.json', '{}')).rejects.toThrow('WRITE_FAILED');
  });
  it('网页保留正常下载，结束后释放 blob URL', async () => {
    native.enabled = false;
    vi.useFakeTimers();
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    const append = vi.fn();
    vi.stubGlobal('document', { createElement: () => anchor, body: { append } });
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { saveBackupFile } = await import('../../src/native/platform');
    expect(await saveBackupFile('backup.json', '{"app":"yesterday-me"}')).toBe(true);
    expect(native.save).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();
    expect(anchor.href).toBe('blob:test');
    expect(anchor.download).toBe('backup.json');
    expect(append).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(3000);
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});
