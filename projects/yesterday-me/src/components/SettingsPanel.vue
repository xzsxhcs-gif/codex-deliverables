<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import type { AppSettings, ImportResult } from '../domain/types';
import { parseBackup, MAX_BACKUP_BYTES } from '../domain/backup';
import Icon from './Icon.vue';
const props = defineProps<{ settings: AppSettings; busy: boolean; offlineReady: boolean; canInstall: boolean; standalone: boolean; registrationError: string; importResult: ImportResult | null; importKey: number }>();
const emit = defineEmits<{ theme: []; export: []; import: [raw: string]; delete: []; install: []; guide: [] }>();
const input = ref<HTMLInputElement>();
const prepared = ref<{ name: string; raw: string; count: number } | null>(null);
const fileError = ref(''), reading = ref(false), persistence = ref('尚未检查'), persistenceBusy = ref(false);
const installHelp = ref(false);
watch(() => props.importKey, () => { prepared.value = null; fileError.value = ''; });
async function selectBackup(event: Event) {
  const field = event.target as HTMLInputElement;
  const file = field.files?.[0]; field.value = '';
  if (!file) return;
  prepared.value = null; fileError.value = ''; reading.value = true;
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('文件超过 10 MB，请选择本应用导出的 JSON 备份。');
    const raw = await file.text();
    const backup = parseBackup(raw);
    prepared.value = { name: file.name, raw, count: backup.capsules.length };
  } catch (error) { fileError.value = error instanceof Error ? error.message : '无法读取文件，请重新选择。'; }
  finally { reading.value = false; }
}
async function requestPersistence() {
  persistenceBusy.value = true;
  try {
    persistence.value = navigator.storage?.persist
      ? (await navigator.storage.persist() ? '已获得持久存储许可' : '浏览器暂未授予许可；仍可正常保存，请定期备份')
      : '此浏览器未提供持久存储申请；请定期备份';
  } catch { persistence.value = '暂时无法申请；请定期备份'; }
  finally { persistenceBusy.value = false; }
}
onMounted(async () => {
  try { persistence.value = await navigator.storage?.persisted?.() ? '已获得持久存储许可' : '由浏览器管理存储空间'; }
  catch { persistence.value = '由浏览器管理存储空间'; }
});
function install() { if (props.canInstall) emit('install'); else installHelp.value = !installHelp.value; }
</script>

<template>
  <div class="settings-panel">
    <section class="settings-section">
      <span class="eyebrow">01 / 你的档案室</span>
      <div class="setting-row"><div><h3>界面外观</h3><p>{{ settings.theme === 'dark' ? '夜间档案室' : '日间档案室' }}</p></div><button class="button button-secondary button-small" :disabled="busy" @click="emit('theme')"><Icon :name="settings.theme === 'dark' ? 'sun' : 'moon'" />切换{{ settings.theme === 'dark' ? '浅色' : '深色' }}</button></div>
      <div class="setting-row"><div><h3>装进口袋，随时开庭</h3><p>{{ standalone ? '正在以独立应用模式运行' : offlineReady ? '离线文件已就绪' : '首次联网打开后，应用将准备离线文件' }}</p></div><button v-if="!standalone" class="button button-secondary button-small" @click="install"><Icon name="download" />安装到桌面</button><span v-else class="status-tag">已安装</span></div>
      <div v-if="installHelp" class="note-box" role="status"><strong>使用浏览器菜单安装</strong><p>安卓 Chrome / Edge：打开右上角菜单，选择「安装应用」或「添加到主屏幕」。iPhone Safari：分享 → 添加到主屏幕。</p><p>需要通过 HTTPS 或本机 localhost 打开；普通局域网 HTTP 地址不支持离线安装。首次联网打开完成后即可离线使用。</p></div>
      <p v-if="registrationError" class="inline-error" role="alert">{{ registrationError }}</p>
    </section>
    <section class="settings-section">
      <span class="eyebrow">02 / 证据的另一份副本</span>
      <h3>备份与迁移</h3><p class="section-copy">记录保存在当前浏览器的 IndexedDB 中。清理网站数据、卸载浏览器或更换设备可能使记录丢失，建议定期导出。</p>
      <div class="button-row"><button class="button button-secondary" :disabled="busy" @click="emit('export')"><Icon name="download" />导出 JSON</button><button class="button button-secondary" :disabled="busy || reading" @click="input?.click()"><Icon name="upload" />{{ reading ? '正在读取…' : '导入备份' }}</button></div>
      <input ref="input" class="sr-only" type="file" accept=".json,application/json" aria-label="选择 JSON 备份文件" :disabled="busy || reading" @change="selectBackup" />
      <p class="fine-print">备份是明文，包含尚未解封的正文、辩护和预测。请自行保管，不要随意分享。</p>
      <p v-if="fileError" class="inline-error" role="alert">{{ fileError }}</p>
      <div v-if="prepared" class="note-box import-preview"><strong>准备合并 {{ prepared.count }} 条记录</strong><p class="file-name">{{ prepared.name }}</p><p>只补充新记录；重复项跳过。同一份证据发生内容冲突时保留本机版本，不覆盖已有判决。导入不会提前解封。</p><div class="button-row"><button class="button button-primary button-small" :disabled="busy" @click="emit('import', prepared.raw)">确认合并导入</button><button class="text-button" :disabled="busy" @click="prepared = null">取消导入</button></div></div>
      <p v-if="importResult && !prepared" class="note-box" role="status">导入完成：新增 {{ importResult.added }} 条，重复 {{ importResult.skipped }} 条，冲突 {{ importResult.conflicts }} 条。冲突记录已保留本机版本。</p>
      <div class="setting-row persistence-row"><div><h3>本机存储</h3><p>{{ persistence }}</p></div><button class="text-button" :disabled="persistenceBusy" @click="requestPersistence">{{ persistenceBusy ? '申请中…' : '申请持久存储' }}</button></div>
      <p class="fine-print">持久存储许可可减少自动清理风险，不能阻止手动删除，也不能代替备份。</p>
    </section>
    <section class="settings-section privacy-section">
      <span class="eyebrow">03 / 本庭的能力边界</span>
      <h3><Icon name="shield" :size="18" />你的记录，只在本机</h3>
      <p>本应用无需账号，不上传留言，也没有追踪脚本。封存是正常界面的时间锁，不是加密保险箱；设备所有者仍能通过开发者工具、备份文件或修改系统日期访问、改变本地数据。</p>
      <p>解封日按封存时的次日日历日期保存，打开时按当前设备的当地日期判断。更换时区或调整日期会影响解封资格。错过解封日也可以随时回来。</p>
      <button class="text-button" @click="emit('guide')">重看使用引导 <span aria-hidden="true">↗</span></button>
    </section>
    <section class="danger-zone"><div><h3>清空档案室</h3><p>删除所有胶囊、判决和偏好设置。无法撤销。</p></div><button class="button button-danger button-small" :disabled="busy" @click="emit('delete')"><Icon name="trash" :size="16" />删除全部数据</button></section>
    <footer class="settings-footer">昨日的我 <span class="mono">v1.0.0</span> · 本庭不受理对正常生活的指控。</footer>
  </div>
</template>
