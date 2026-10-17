<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import Icon from './components/Icon.vue';
import Modal from './components/Modal.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import CaseDetail from './components/CaseDetail.vue';
import SealView from './views/SealView.vue';
import TrialView from './views/TrialView.vue';
import ArchiveView from './views/ArchiveView.vue';
import StatsView from './views/StatsView.vue';
import { useCapsules, readableError } from './composables/useCapsules';
import { usePwa } from './composables/usePwa';
import { isUnlocked, localDate, nextMidnight, nextLocalDate } from './domain/calendar';
import { calculateStatistics } from './domain/stats';
import { pickRemark } from './domain/humor';
import type { CaseFile, SealInput, Outcome, ImportResult } from './domain/types';

const db = useCapsules();
const { items, stats, settings, ready, loading, busy, error, now } = db;
const { offlineReady, needRefresh, updateApp, canInstall, install, isStandalone, registrationError } = usePwa();
const pages = [
  { id: 'seal', label: '封存', icon: 'seal', note: '写给明天' },
  { id: 'trial', label: '待审', icon: 'trial', note: '与昨日对话' },
  { id: 'archive', label: '档案', icon: 'archive', note: '一切已有定论' },
  { id: 'stats', label: '统计', icon: 'stats', note: '不太严肃的报告' },
] as const;
type Page = typeof pages[number]['id'];
function currentHash(): Page { const page = location.hash.slice(1); return pages.some(item => item.id === page) ? page as Page : 'seal'; }
const page = ref<Page>(currentHash());
const main = ref<HTMLElement>();
const settingsOpen = ref(false), guideOpen = ref(false), deleteOpen = ref(false), updateOpen = ref(false);
const activeCase = ref<CaseFile | null>(null), opening = ref(false), animateVerdict = ref(false);
const successKey = ref(0), importKey = ref(0), importResult = ref<ImportResult | null>(null);
const deleteWord = ref('');
const anyModal = computed(() => guideOpen.value || settingsOpen.value || !!activeCase.value || deleteOpen.value || updateOpen.value);
const toast = ref<{ message: string; kind: 'success' | 'error' } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const visibleItems = computed(() => items.value.map(item => item.status !== 'judged' && !isUnlocked(item.unlockDate, new Date(now.value)) ? { ...item, title: null, status: 'sealed' as const } : item));
const lockedCount = computed(() => visibleItems.value.filter(item => item.status === 'sealed').length);
const readyCount = computed(() => visibleItems.value.filter(item => item.status === 'ready').length);
const dateLabel = computed(() => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now.value));
const dayCode = computed(() => localDate(new Date(now.value)).replaceAll('-', '.'));
const nextUnlock = computed(() => visibleItems.value.filter(item => item.status === 'sealed').map(item => item.unlockDate).sort()[0]);
const countdown = computed(() => {
  const current = new Date(now.value);
  let target = nextMidnight(current);
  if (nextUnlock.value) {
    const [year, month, day] = nextUnlock.value.split('-').map(Number);
    target = new Date(year, month - 1, day);
  }
  const seconds = Math.max(0, Math.floor((target.getTime() - now.value) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(part => String(part).padStart(2, '0')).join(':');
});
const unlockLabel = computed(() => `${nextUnlock.value ?? nextLocalDate(new Date(now.value))} 00:00`);

function message(text: string, kind: 'success' | 'error' = 'success') { clearTimeout(toastTimer); toast.value = { message: text, kind }; toastTimer = setTimeout(() => { toast.value = null; }, kind === 'error' ? 9000 : 5500); }
function navigate(value: Page) { page.value = value; history.replaceState(null, '', `#${value}`); window.scrollTo({ top: 0 }); main.value?.focus({ preventScroll: true }); }
const hashChange = () => { page.value = currentHash(); };
async function start() { await db.initialize(); if (ready.value && !settings.value.onboardingDone) guideOpen.value = true; }
async function seal(input: SealInput) {
  if (busy.value) return;
  try { await db.mutate(() => db.repository.seal(input)); successKey.value++; message(`证据已封存。被告暂时安全。\n${pickRemark('sealed')}`); }
  catch (e) { message(readableError(e), 'error'); }
}
async function openCase(id: string) {
  if (opening.value) return;
  opening.value = true; animateVerdict.value = false;
  try { activeCase.value = await db.repository.open(id); }
  catch (e) { message(readableError(e), 'error'); await db.sync(); }
  finally { opening.value = false; }
}
async function judge(input: { id: string; outcome: Outcome }) {
  if (busy.value) return;
  try { const result = await db.mutate(() => db.repository.judge(input.id, input.outcome)); activeCase.value = result; animateVerdict.value = true; }
  catch (e) { message(readableError(e), 'error'); await db.sync(); }
}
async function changeTheme() {
  if (busy.value) return;
  const theme = settings.value.theme === 'dark' ? 'light' : 'dark';
  try { await db.mutate(() => db.repository.saveSettings({ theme })); settings.value.theme = theme; }
  catch (e) { message(readableError(e), 'error'); }
}
async function finishGuide() {
  try { await db.mutate(() => db.repository.saveSettings({ onboardingDone: true })); settings.value.onboardingDone = true; guideOpen.value = false; }
  catch (e) { message(readableError(e), 'error'); }
}
async function exportBackup() {
  try {
    const backup = await db.repository.exportBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `yesterday-me-${localDate(new Date())}-${Date.now()}.json`;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
    message('备份已生成，请妥善保管。平行宇宙暂不提供保管服务。');
  } catch (e) { message(readableError(e), 'error'); }
}
async function importBackup(raw: string) {
  if (busy.value) return;
  try { importResult.value = await db.mutate(() => db.repository.importBackup(raw)); importKey.value++; message('备份已合并。已有判决保持原样。'); }
  catch (e) { message(readableError(e), 'error'); }
}
async function clearData() {
  if (busy.value || deleteWord.value !== '删除') return;
  try { await db.mutate(() => db.repository.clearAll()); items.value = []; stats.value = calculateStatistics([], new Date()); settings.value = { theme: 'dark', onboardingDone: false }; activeCase.value = null; deleteOpen.value = false; settingsOpen.value = false; deleteWord.value = ''; successKey.value++; importResult.value = null; navigate('seal'); message('本机档案已清空。新的故事可以重新开始。'); }
  catch (e) { message(readableError(e), 'error'); }
}
async function installApp() { try { const result = await install(); if (result === 'accepted') message('安装请求已提交，请按浏览器提示完成。'); } catch { message('安装暂未完成，可通过浏览器菜单添加到桌面。', 'error'); } }
async function refreshApp() { try { await updateApp(); updateOpen.value = false; } catch { message('更新未完成，当前版本仍可使用。请稍后重试。', 'error'); } }

watch(() => settings.value.theme, theme => { document.documentElement.dataset.theme = theme; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0d0f12' : '#f3f2ee'); }, { immediate: true });
watch([now, activeCase], () => {
  if (activeCase.value?.status === 'ready' && !isUnlocked(activeCase.value.unlockDate, new Date(now.value))) activeCase.value = null;
});
watch(items, async () => {
  if (!activeCase.value) return;
  const id = activeCase.value.id, summary = items.value.find(item => item.id === id);
  if (!summary || summary.status === 'sealed') { activeCase.value = null; return; }
  if (summary.status === 'judged' && activeCase.value.status !== 'judged') {
    try { const result = await db.repository.open(id); if (activeCase.value?.id === id) activeCase.value = result; } catch { activeCase.value = null; }
  }
});
onMounted(() => { void start(); window.addEventListener('hashchange', hashChange); });
onBeforeUnmount(() => { clearTimeout(toastTimer); window.removeEventListener('hashchange', hashChange); });
</script>

<template>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <div class="app-shell">
    <header class="app-header">
      <a href="#seal" class="brand" aria-label="昨日的我，返回封存" @click.prevent="navigate('seal')"><span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span><span><strong>昨日的我<span class="brand-period">.</span></strong><small>跨时空自我审判系统</small></span></a>
      <div class="header-actions"><span class="local-status"><i></i>本机档案室</span><button class="icon-button" :disabled="!ready || busy" :aria-label="settings.theme === 'dark' ? '切换浅色模式' : '切换深色模式'" @click="changeTheme"><Icon :name="settings.theme === 'dark' ? 'sun' : 'moon'" /></button><button class="icon-button" :disabled="!ready" aria-label="设置与数据" @click="settingsOpen = true"><Icon name="settings" /></button></div>
    </header>
    <div class="workspace">
      <aside class="sidebar">
        <div class="sidebar-meta"><span class="eyebrow">个人时间档案馆</span><span class="mono">{{ dayCode }}</span></div>
        <nav class="main-nav" aria-label="主要导航"><button v-for="entry in pages" :key="entry.id" class="nav-item" :class="{ active: page === entry.id }" :aria-current="page === entry.id ? 'page' : undefined" @click="navigate(entry.id)"><Icon :name="entry.icon" :size="21" /><span class="nav-label">{{ entry.label }}<small>{{ entry.note }}</small></span><span v-if="entry.id === 'trial' && readyCount" class="nav-count" :aria-label="`${readyCount} 份待审`">{{ readyCount > 99 ? '99+' : readyCount }}</span></button></nav>
        <div class="sidebar-note"><span class="tiny-cross">+</span><p>昨天的你已离线。<br />今天的你，说了算。</p><span class="eyebrow">YESTERDAY ME / V.01</span></div>
      </aside>
      <main id="main" ref="main" tabindex="-1">
        <div class="main-meta"><span>私人档案 <span class="meta-slash">/</span> {{ pages.find(entry => entry.id === page)?.label }}</span><time :datetime="localDate(new Date(now))">{{ dateLabel }}</time></div>
        <div v-if="needRefresh" class="update-banner" role="status"><span>有一个新版本等你。未封存的草稿请先处理。</span><button class="text-button" @click="updateOpen = true">查看更新</button></div>
        <div v-if="loading" class="loading-state" role="status"><span class="loading-mark"></span><h1>正在打开档案室</h1><p>昨日的自己还在路上。</p></div>
        <div v-else-if="!ready" class="error-state" role="alert"><Icon name="archive" :size="36" /><h1>档案室暂时打不开</h1><p>{{ error }}</p><button class="button button-primary" @click="start">重新连接本地存储</button><p class="fine-print">不会自动删除或重建你的记录。</p></div>
        <template v-else>
          <div v-if="error" class="inline-error sync-error" role="alert">{{ error }}<button class="text-button" @click="db.sync">重新读取</button></div>
          <SealView v-show="page === 'seal'" :busy="busy" :locked-count="lockedCount" :ready-count="readyCount" :countdown="countdown" :unlock-label="unlockLabel" :success-key="successKey" @seal="seal" @show-ready="navigate('trial')" />
          <TrialView v-show="page === 'trial'" :items="visibleItems" :busy="busy || opening" @open="openCase" />
          <ArchiveView v-show="page === 'archive'" :items="visibleItems" @open="openCase" />
          <StatsView v-show="page === 'stats'" :stats="stats" />
          <footer class="main-footer"><span><Icon name="shield" :size="13" />记录仅保存在本设备</span><button class="text-button" @click="settingsOpen = true">备份与数据说明 <span aria-hidden="true">↗</span></button></footer>
        </template>
      </main>
    </div>
  </div>
  <div v-if="toast && !anyModal" class="toast" :class="toast.kind" :role="toast.kind === 'error' ? 'alert' : 'status'"><Icon :name="toast.kind === 'error' ? 'info' : 'check'" :size="18" /><span>{{ toast.message }}</span><button class="icon-button" aria-label="关闭提示" @click="toast = null"><Icon name="close" :size="15" /></button></div>
  <Modal v-if="guideOpen" title="今天留一句，明天再说。" eyebrow="欢迎来到昨日的我 / 01" :dismissable="settings.onboardingDone" :notice="toast" @dismiss-notice="toast = null" @close="guideOpen = false">
    <div class="onboarding"><p class="intro-copy">一个能让你隔着一天，和自己对话的小地方。<br />至于“审判”，请别太认真。</p><ol class="guide-steps"><li><span>01</span><div><h3>留下一份证据</h3><p>写一句想法、计划或消费理由，再猜猜明天的自己会怎么想。</p></div></li><li><span>02</span><div><h3>交给时间保管</h3><p>封存后暂时不能查看或修改。当地时间次日 00:00 起，随时都能回来打开。</p></div></li><li><span>03</span><div><h3>开个小小的庭</h3><p>可以无罪释放，也可以轻轻哈气。你也可以只读留言，暂不宣判。</p></div></li></ol><div class="note-box">休息、消费、普通生活，都不是真正的罪过。本庭不负责制造愧疚。</div><p class="fine-print">数据只在本机，封存并非加密保护。请在「设置与数据」中定期备份。</p><button class="button button-primary button-full" :disabled="busy" @click="finishGuide">{{ busy ? '正在准备…' : '开启第一份档案' }}<Icon name="arrow" /></button></div>
  </Modal>
  <Modal v-if="settingsOpen" title="档案室设置" eyebrow="PREFERENCES / 你的数据由你保管" :notice="deleteOpen ? null : toast" @dismiss-notice="toast = null" @close="settingsOpen = false">
    <SettingsPanel :settings="settings" :busy="busy" :offline-ready="offlineReady" :can-install="canInstall" :standalone="isStandalone" :registration-error="registrationError" :import-result="importResult" :import-key="importKey" @theme="changeTheme" @export="exportBackup" @import="importBackup" @delete="deleteWord = ''; deleteOpen = true" @install="installApp" @guide="settingsOpen = false; guideOpen = true" />
  </Modal>
  <Modal v-if="activeCase" :title="`第 ${String(activeCase.caseNumber).padStart(3, '0')} 号案件`" :eyebrow="`${activeCase.sealedDate} / ${activeCase.status === 'judged' ? '判决已归档' : '跨时空庭审'}`" :dismissable="!busy" :notice="toast" @dismiss-notice="toast = null" wide @close="activeCase = null; animateVerdict = false"><CaseDetail :case-file="activeCase" :busy="busy" :animate-verdict="animateVerdict" @judge="judge" /></Modal>
  <Modal v-if="deleteOpen" title="确定清空全部档案？" eyebrow="最后一次确认" :dismissable="!busy" :notice="toast" @dismiss-notice="toast = null" @close="deleteOpen = false">
    <p class="intro-copy">将删除本设备当前浏览器中的 {{ items.length }} 份胶囊、全部判决和偏好设置。操作无法撤销。</p><p class="section-copy">若需要保留记录，请先取消并导出备份。</p><label class="field-label" for="delete-word">输入「删除」以确认</label><input id="delete-word" v-model="deleteWord" class="text-input" autocomplete="off" placeholder="删除" /><div class="button-row dialog-actions"><button class="button button-secondary" :disabled="busy" @click="deleteOpen = false">保留档案</button><button class="button button-danger" :disabled="deleteWord !== '删除' || busy" @click="clearData">{{ busy ? '正在清空…' : '确认删除全部数据' }}</button></div>
  </Modal>
  <Modal v-if="updateOpen" title="准备更新应用" eyebrow="档案室维护" :notice="toast" @dismiss-notice="toast = null" @close="updateOpen = false"><p class="intro-copy">更新会重新加载页面。请先封存正在编辑的留言；未封存的草稿不会保留。已经存入数据库的记录不受影响。</p><div class="button-row dialog-actions"><button class="button button-secondary" @click="updateOpen = false">继续编辑</button><button class="button button-primary" @click="refreshApp">确认更新</button></div></Modal>
</template>
