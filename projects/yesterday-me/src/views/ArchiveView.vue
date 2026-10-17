<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CapsuleSummary, Outcome } from '../domain/types';

const props = defineProps<{ items: CapsuleSummary[] }>();
const emit = defineEmits<{ open: [id: string] }>();

type Filter = 'all' | Outcome;
const filter = ref<Filter>('all');
const sortOrder = ref<'newest' | 'oldest'>('newest');
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: '全部案件' },
  { value: 'forgive', label: '无罪释放' },
  { value: 'hiss', label: '对自己哈气' },
];
const archived = computed(() => props.items.filter((item) => item.status === 'judged' && item.verdict));
const countFor = (value: Filter) => archived.value.filter((item) => value === 'all' || item.verdict?.outcome === value).length;
const visibleItems = computed(() => {
  const direction = sortOrder.value === 'newest' ? -1 : 1;
  return archived.value
    .filter((item) => filter.value === 'all' || item.verdict?.outcome === filter.value)
    .sort((a, b) => direction * ((a.verdict!.judgedAt - b.verdict!.judgedAt) || (a.caseNumber - b.caseNumber)));
});
const caseNumber = (number: number) => String(number).padStart(3, '0');
const displayDate = (date: string) => date.replaceAll('-', '.');

function predictionLabel(item: CapsuleSummary): string {
  if (item.verdict?.predictionMatched === true) return '预测成功';
  if (item.verdict?.predictionMatched === false) return '预测落空';
  return '昨日选择了不好说';
}
</script>

<template>
  <section class="archive-view" aria-labelledby="archive-heading">
    <header class="page-heading">
      <div>
        <p class="section-label"><span aria-hidden="true"></span> 时间已归档</p>
        <h1 id="archive-heading">往事不再开庭。</h1>
        <p class="heading-copy">判决不能改，昨天可以再看一眼。</p>
      </div>
      <div class="archive-total" aria-label="已归档案件数">
        <span class="archive-total-value">{{ String(archived.length).padStart(2, '0') }}</span>
        <span>份判决档案</span>
      </div>
    </header>

    <div class="archive-toolbar">
      <div class="filter-group" role="group" aria-label="按判决筛选">
        <button
          v-for="option in filters"
          :key="option.value"
          type="button"
          class="filter-button"
          :class="{ selected: filter === option.value }"
          :aria-pressed="filter === option.value"
          @click="filter = option.value"
        >
          {{ option.label }}<span class="filter-count">{{ countFor(option.value) }}</span>
        </button>
      </div>
      <label class="sort-control">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 4v12m-3-3 3 3 3-3M11 5h6m-6 5h4m-4 5h2" /></svg>
        <span class="visually-hidden">归档日期排序</span>
        <select v-model="sortOrder" aria-label="归档日期排序">
          <option value="newest">最新归档在前</option>
          <option value="oldest">最早归档在前</option>
        </select>
      </label>
    </div>

    <div v-if="visibleItems.length" class="archive-list">
      <div class="list-key" aria-hidden="true"><span>案件 / 原始留言</span><span>最终判决</span></div>
      <button
        v-for="item in visibleItems"
        :key="item.id"
        class="archive-row"
        type="button"
        :aria-label="`${item.verdict!.judgedDate}，第 ${caseNumber(item.caseNumber)} 号案件，${item.title || '未命名证据'}，${item.verdict!.outcome === 'forgive' ? '无罪释放' : '对自己哈气'}，查看档案`"
        @click="emit('open', item.id)"
      >
        <span class="case-index" aria-hidden="true">{{ caseNumber(item.caseNumber) }}</span>
        <span class="case-copy">
          <span class="case-meta">{{ displayDate(item.verdict!.judgedDate) }} <span aria-hidden="true">/</span> 第 {{ caseNumber(item.caseNumber) }} 号案件</span>
          <span class="case-title">{{ item.title || '未命名证据' }}</span>
          <span class="prediction-result">{{ predictionLabel(item) }}</span>
        </span>
        <span class="case-outcome" :class="item.verdict!.outcome">
          <svg v-if="item.verdict!.outcome === 'forgive'" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 10 3.2 3.2L15 6.5" /></svg>
          <svg v-else viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 6.5 8 9m8-2.5L12 9M7 14l3-2 3 2" /></svg>
          {{ item.verdict!.outcome === 'forgive' ? '无罪释放' : '已哈气' }}
        </span>
        <svg class="row-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg>
      </button>
    </div>

    <div v-else class="archive-empty" role="status">
      <div class="empty-folder" aria-hidden="true">
        <svg viewBox="0 0 96 80" fill="none"><path d="M17 27V16h26l7 8h29v41H17z" /><path d="M12 32h72l-5 38H17z" /><path d="M39 48h18m-18 7h11" /></svg>
        <span>{{ archived.length ? '无匹配' : '尚未归档' }}</span>
      </div>
      <h2>{{ archived.length ? '这一类，暂时没有案底。' : '档案柜还是空的。' }}</h2>
      <p>{{ archived.length ? '换个判决类型，看看昨天留下了什么。' : '完成第一次审判后，昨天就会搬到这里。' }}</p>
      <button v-if="archived.length" type="button" class="reset-filter" @click="filter = 'all'">查看全部案件 <span aria-hidden="true">↗</span></button>
    </div>

    <footer class="archive-note"><span aria-hidden="true">↳</span> 昨天的你已离线。这里保留证据，也保留和解。</footer>
  </section>
</template>

<style scoped>
.archive-view { min-width: 0; }
.page-heading { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; padding: 0 0 30px; }
.section-label { display: flex; gap: 9px; align-items: center; margin: 0 0 15px; color: var(--muted); font-size: 11px; letter-spacing: .16em; }
.section-label span { width: 5px; height: 5px; background: var(--accent); border-radius: 50%; }
h1 { margin: 0; font-size: clamp(27px, 4vw, 38px); font-weight: 650; letter-spacing: -.045em; line-height: 1.3; }
.heading-copy { color: var(--muted); margin: 12px 0 0; font-size: 13px; line-height: 1.8; }
.archive-total { display: flex; align-items: flex-end; flex-direction: column; gap: 7px; flex-shrink: 0; color: var(--muted); font-size: 10px; letter-spacing: .06em; }
.archive-total-value { color: var(--text); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 39px; line-height: 1; letter-spacing: -.065em; font-weight: 400; }
.archive-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 0; border-top: 1px solid var(--line); }
.filter-group { display: flex; flex-wrap: wrap; gap: 6px; }
.filter-button { border: 1px solid transparent; background: transparent; color: var(--muted); font: inherit; font-size: 12px; padding: 9px 11px; min-height: 40px; border-radius: 7px; cursor: pointer; transition: background .15s, color .15s; white-space: nowrap; }
.filter-button:hover { background: var(--surface-2); color: var(--text); }
.filter-button.selected { background: var(--surface-2); border-color: var(--line); color: var(--text); }
.filter-count { display: inline-block; margin-left: 7px; opacity: .55; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 10px; }
.sort-control { display: flex; align-items: center; gap: 5px; color: var(--muted); white-space: nowrap; }
.sort-control svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.4; }
.sort-control select { font: inherit; font-size: 11px; border: 0; color: var(--muted); background: var(--bg); padding: 10px 3px; min-height: 40px; cursor: pointer; }
.archive-list { border-top: 1px solid var(--line); }
.list-key { display: flex; justify-content: space-between; padding: 15px 38px 15px 76px; color: var(--muted); font-size: 10px; letter-spacing: .08em; }
.archive-row { display: flex; align-items: center; gap: 20px; width: 100%; border: 0; border-bottom: 1px solid var(--line); color: var(--text); background: transparent; font: inherit; padding: 25px 12px 25px 8px; text-align: left; cursor: pointer; transition: background .18s; }
.archive-row:hover { background: var(--surface); }
.case-index { width: 48px; flex-shrink: 0; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 25px; color: var(--muted); font-weight: 300; letter-spacing: -.04em; opacity: .5; }
.case-copy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 9px; }
.case-meta { color: var(--muted); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 10px; letter-spacing: .01em; line-height: 1.6; }
.case-meta > span { padding: 0 5px; opacity: .4; }
.case-title { font-size: 15px; font-weight: 550; line-height: 1.6; overflow-wrap: anywhere; }
.prediction-result { font-size: 11px; color: var(--muted); }
.case-outcome { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; white-space: nowrap; }
.case-outcome.forgive { color: var(--good); }
.case-outcome.hiss { color: var(--bad); }
.case-outcome svg { width: 17px; height: 17px; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.row-arrow { width: 16px; height: 16px; flex-shrink: 0; stroke: var(--muted); stroke-width: 1.5; opacity: .6; }
.archive-empty { text-align: center; padding: 57px 20px 72px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.empty-folder { position: relative; width: 104px; margin: 0 auto 26px; }
.empty-folder svg { width: 96px; height: 80px; stroke: var(--muted); stroke-width: 1; opacity: .6; }
.empty-folder svg path:nth-child(2) { fill: var(--surface); }
.empty-folder span { position: absolute; bottom: -1px; right: -15px; color: var(--muted); font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 9px; padding: 5px 7px; border: 1px solid var(--line); background: var(--bg); transform: rotate(-9deg); }
.archive-empty h2 { font-size: 17px; font-weight: 500; margin: 0 0 11px; }
.archive-empty p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.9; }
.reset-filter { display: inline-flex; gap: 14px; color: var(--accent); background: none; border: 0; border-bottom: 1px solid var(--line); padding: 11px 2px; margin-top: 20px; font: inherit; font-size: 12px; cursor: pointer; }
.archive-note { display: flex; gap: 9px; color: var(--muted); font-size: 11px; line-height: 1.9; margin-top: 23px; }
.archive-note > span { opacity: .5; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
button:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
@media (max-width: 640px) {
  .page-heading { gap: 12px; padding-bottom: 25px; }
  .archive-total-value { font-size: 31px; }
  .archive-total { font-size: 9px; padding-bottom: 4px; }
  .heading-copy { max-width: 220px; font-size: 12px; }
  .archive-toolbar { flex-wrap: wrap; gap: 9px; padding: 16px 0 10px; }
  .filter-button { padding: 9px 10px; font-size: 11px; }
  .sort-control { margin-left: auto; }
  .list-key { padding-left: 0; padding-right: 30px; }
  .archive-row { gap: 10px; padding: 22px 0; }
  .case-index { display: none; }
  .case-title { font-size: 14px; }
  .case-meta { font-size: 9px; }
  .case-outcome { gap: 3px; font-size: 10px; }
  .row-arrow { width: 13px; }
  .archive-empty { padding: 45px 10px 58px; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
