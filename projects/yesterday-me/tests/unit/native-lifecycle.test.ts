import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  native: true,
  callbacks: new Map<string, (event?: { isActive: boolean }) => void>(),
  removers: [] as ReturnType<typeof vi.fn>[],
  minimize: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => state.native }, registerPlugin: () => ({}) }));
vi.mock('@capacitor/app', () => ({ App: {
  addListener: vi.fn(async (name: string, callback: (event?: { isActive: boolean }) => void) => {
    state.callbacks.set(name, callback);
    const remove = vi.fn(async () => {});
    state.removers.push(remove);
    return { remove };
  }),
  minimizeApp: state.minimize,
} }));
beforeEach(() => { vi.resetModules(); state.native = true; state.callbacks.clear(); state.removers = []; state.minimize.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); });

async function setup(dialogs: { dispatchEvent: (event: Event) => boolean }[] = [], navigate = vi.fn(() => false)) {
  vi.stubGlobal('document', { querySelectorAll: () => dialogs });
  const { installNativeLifecycle } = await import('../../src/native/lifecycle');
  const resume = vi.fn();
  const remove = installNativeLifecycle(navigate, resume);
  await Promise.resolve();
  return { navigate, resume, remove };
}

describe('Android 返回键与恢复', () => {
  it('只向最上层弹窗发可取消的 cancel，保留弹窗自己的忙碌/首次引导约束', async () => {
    const lower = { dispatchEvent: vi.fn((_event: Event) => false) }, upper = { dispatchEvent: vi.fn((_event: Event) => false) };
    const { navigate } = await setup([lower, upper]);
    state.callbacks.get('backButton')?.();
    expect(lower.dispatchEvent).not.toHaveBeenCalled();
    expect(upper.dispatchEvent).toHaveBeenCalledOnce();
    expect(upper.dispatchEvent.mock.calls[0]?.[0]).toMatchObject({ type: 'cancel', cancelable: true });
    expect(navigate).not.toHaveBeenCalled();
    expect(state.minimize).not.toHaveBeenCalled();
  });
  it('无弹窗时先返回封存页，而非离开有草稿的页面', async () => {
    await setup([], vi.fn(() => true));
    state.callbacks.get('backButton')?.();
    expect(state.minimize).not.toHaveBeenCalled();
  });
  it('封存首页返回键只退到后台；恢复前台重新检查本地日期', async () => {
    const { resume, remove } = await setup();
    state.callbacks.get('backButton')?.();
    expect(state.minimize).toHaveBeenCalledOnce();
    state.callbacks.get('appStateChange')?.({ isActive: false });
    expect(resume).not.toHaveBeenCalled();
    state.callbacks.get('appStateChange')?.({ isActive: true });
    expect(resume).toHaveBeenCalledOnce();
    remove();
    expect(state.removers).toHaveLength(2);
    expect(state.removers.every(handle => handle.mock.calls.length === 1)).toBe(true);
  });
  it('普通浏览器不注册 Android 回调', async () => {
    state.native = false;
    const { remove } = await setup();
    remove();
    expect(state.callbacks.size).toBe(0);
  });
});
