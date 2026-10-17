import { ref, onMounted, onBeforeUnmount } from 'vue';
import { CapsuleRepository } from '../domain/repository';
import { DomainError } from '../domain/errors';
import { localDate } from '../domain/calendar';
import type { AppSettings, CapsuleSummary, Statistics } from '../domain/types';

export function readableError(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    const messages: Record<string, string> = {
      LOCKED: '还没到解封日。昨天的你暂时受到时间保护。',
      ALREADY_JUDGED: '本案已经宣判。判决不能修改，可以在档案中重看。',
      NOT_FOUND: '这份证据已不存在，可能在另一个标签页中被删除。',
      INVALID_INPUT: '请检查输入：留言不能为空，预测需要选择，内容不能超出字数限制。',
      INVALID_BACKUP: '备份格式不符合要求。请使用本应用导出的完整 JSON 文件；现有数据未被改动。',
    };
    if (messages[code]) return messages[code];
  }
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return '本机存储空间不足，尚未保存。请先备份并清理设备空间。';
  return '本地数据库暂时无法操作。请保留输入后重试，并确认浏览器允许保存网站数据。';
}

export function useCapsules() {
  const repository = new CapsuleRepository();
  const items = ref<CapsuleSummary[]>([]);
  const stats = ref<Statistics | null>(null);
  const settings = ref<AppSettings>({ theme: 'dark', onboardingDone: false });
  const loading = ref(true), busy = ref(false), ready = ref(false), error = ref('');
  const now = ref(Date.now());
  let channel: BroadcastChannel | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let refreshSequence = 0;
  let previousDay = localDate(new Date(now.value));

  async function refresh() {
    const sequence = ++refreshSequence;
    const [nextItems, nextStats, nextSettings] = await Promise.all([repository.list(), repository.stats(), repository.getSettings()]);
    if (sequence !== refreshSequence) return;
    items.value = nextItems; stats.value = nextStats; settings.value = nextSettings;
    now.value = Date.now(); error.value = '';
  }
  async function initialize() {
    loading.value = true;
    try { await repository.init(); await refresh(); ready.value = true; }
    catch (e) { error.value = readableError(e); ready.value = false; }
    finally { loading.value = false; }
  }
  async function sync() {
    now.value = Date.now();
    if (!ready.value) return;
    try { await refresh(); } catch (e) { error.value = readableError(e); }
  }
  function notifyTabs() {
    try { if (channel) { channel.postMessage({ type: 'records-updated' }); return; } } catch { /* A closed channel must not undo a committed operation. */ }
    try { localStorage.setItem('yesterday-me:refresh', `${Date.now()}:${Math.random()}`); } catch { /* Focus and midnight also trigger synchronization. */ }
  }
  async function mutate<T>(operation: () => Promise<T>): Promise<T> {
    if (busy.value) throw new Error('An operation is already in progress.');
    busy.value = true;
    try {
      const result = await operation();
      notifyTabs();
      try { await refresh(); }
      catch { error.value = '操作已完成并写入本机，但列表暂未刷新。请重新读取，不必重复提交。'; }
      return result;
    }
    finally { busy.value = false; }
  }
  const visible = () => { if (document.visibilityState === 'visible') void sync(); };
  const storage = (event: StorageEvent) => { if (event.key === 'yesterday-me:refresh') void sync(); };
  onMounted(() => {
    try { if ('BroadcastChannel' in window) { channel = new BroadcastChannel('yesterday-me:changes'); channel.onmessage = () => void sync(); } } catch { /* Storage events handle browsers without this API. */ }
    window.addEventListener('focus', sync);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    timer = setInterval(() => {
      now.value = Date.now();
      const day = localDate(new Date(now.value));
      if (day !== previousDay) { previousDay = day; void sync(); }
    }, 1000);
  });
  onBeforeUnmount(() => {
    clearInterval(timer); channel?.close(); repository.close();
    window.removeEventListener('focus', sync); window.removeEventListener('storage', storage);
    document.removeEventListener('visibilitychange', visible);
  });
  return { repository, items, stats, settings, loading, busy, ready, error, now, initialize, refresh, mutate, sync };
}
