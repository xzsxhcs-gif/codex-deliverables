<script setup lang="ts">
import { computed } from 'vue';
import type { CapsuleSummary } from '../domain/types';
const props = defineProps<{ items: CapsuleSummary[]; busy: boolean }>();
const emit = defineEmits<{ open: [id: string] }>();
const ready = computed(() => props.items.filter(item => item.status === 'ready').sort((a, b) => a.sealedAt - b.sealedAt));
const sealed = computed(() => props.items.filter(item => item.status === 'sealed').sort((a, b) => a.sealedAt - b.sealedAt));
const number = (value: number) => String(value).padStart(3, '0');
</script>

<template>
  <section class="trial-view page-view" aria-labelledby="trial-heading" :aria-busy="busy">
    <header class="page-heading"><div class="eyebrow">昨日来信 · 今日开庭</div><h1 id="trial-heading">待审证据<span class="heading-period">.</span></h1><p>不急着下结论。先听听昨天的自己怎么说。</p></header>
    <div class="trial-status-bar"><span><i class="status-dot ready-dot" aria-hidden="true"></i><strong>{{ ready.length }}</strong> 份可以打开</span><span><i class="status-dot locked-dot" aria-hidden="true"></i><strong>{{ sealed.length }}</strong> 份等待明天</span></div>

    <div v-if="!ready.length" class="empty-state trial-empty">
      <div class="empty-drawing" aria-hidden="true"><svg viewBox="0 0 120 100" fill="none"><path d="M23 29h30l8 9h36v43H23z" stroke="currentColor" stroke-width="1.3" /><path d="M23 41h74m-54 17h34m-34 8h20" stroke="currentColor" stroke-width="1.3" /><circle cx="83" cy="24" r="13" fill="var(--surface)" stroke="currentColor" stroke-width="1.3" /><path d="M83 17v7l5 3" stroke="var(--accent)" stroke-width="1.3" /><path d="M32 16h16M15 61h-5m95-9h6" stroke="currentColor" stroke-width="1.1" opacity=".45" /></svg></div>
      <h2>{{ sealed.length ? '时间还没传唤昨天的你。' : '今日休庭，昨日尚无证据。' }}</h2>
      <p>{{ sealed.length ? '证据在好好保管。等当地日期翻过这一页，再来拆封。' : '去「封存」留一条消息。明天，就有了跨时空对话的理由。' }}</p>
      <span class="empty-note">本庭不接受来自平行宇宙的证据。</span>
    </div>

    <section v-if="ready.length" aria-labelledby="ready-title" class="case-section">
      <div class="section-heading"><h2 id="ready-title">可以拆封</h2><span>按封存时间 · 较早优先</span></div>
      <ul class="case-list"><li v-for="item in ready" :key="item.id">
        <button class="case-item ready-case" type="button" :disabled="busy" @click="emit('open', item.id)">
          <span class="case-number">{{ number(item.caseNumber) }}</span>
          <span class="case-item-content"><span class="case-meta">{{ item.sealedDate }} <span aria-hidden="true">/</span> 第 {{ number(item.caseNumber) }} 号案件</span><strong>{{ item.title || '未命名证据' }}</strong><span class="case-subtitle">证据已到达。请你本人拆封。</span></span>
          <span class="case-open"><span>打开</span><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5" /></svg></span>
        </button>
      </li></ul>
    </section>

    <section v-if="sealed.length" aria-labelledby="sealed-title" class="case-section locked-section">
      <div class="section-heading"><h2 id="sealed-title">尚未解锁</h2><span>内容封存中</span></div>
      <ul class="case-list"><li v-for="item in sealed" :key="item.id" class="case-item locked-case">
        <span class="case-number"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="6" y="10" width="12" height="10" rx="2" /><path d="M9 10V7a3 3 0 0 1 6 0v3m-3 5v2" /></svg></span>
        <span class="case-item-content"><span class="case-meta">{{ item.sealedDate }} <span aria-hidden="true">/</span> 第 {{ number(item.caseNumber) }} 号案件</span><strong>证据已封存</strong><span class="case-subtitle">{{ item.unlockDate }} 当地时间 00:00 起可打开</span></span>
        <span class="sealed-badge">保管中</span>
      </li></ul>
    </section>
    <p v-if="ready.length || sealed.length" class="page-footnote">过了解锁日期也没关系，证据会一直等你。</p>
  </section>
</template>

<style scoped>
.eyebrow { color: var(--muted); font-size: .69rem; letter-spacing: .13em; font-weight: 550; }.page-heading h1 { font-size: clamp(2.1rem, 5vw, 3rem); letter-spacing: -.055em; margin: 16px 0 13px; font-weight: 650; }.heading-period { color: var(--accent); }.page-heading p { color: var(--muted); font-size: .84rem; line-height: 1.8; }.trial-status-bar { display: flex; flex-wrap: wrap; gap: 12px 25px; padding: 21px 0 23px; margin-bottom: 9px; border-bottom: 1px solid var(--line); font-size: .72rem; color: var(--muted); }.trial-status-bar > span { display: flex; align-items: center; gap: 6px; }.trial-status-bar strong { color: var(--text); font-family: ui-monospace, monospace; font-size: .88rem; font-weight: 500; }.status-dot { width: 5px; height: 5px; border-radius: 50%; margin-right: 3px; }.ready-dot { background: var(--accent); }.locked-dot { background: var(--muted); opacity: .5; }
.trial-empty { border: 1px dashed var(--line); border-radius: 15px; padding: 34px 25px; margin: 24px 0; text-align: center; background: var(--surface); }.empty-drawing { width: 110px; margin: 0 auto 12px; color: var(--muted); }.empty-drawing svg { display: block; width: 100%; }.trial-empty h2 { font-size: .98rem; font-weight: 550; letter-spacing: -.025em; }.trial-empty > p { margin: 12px auto; max-width: 300px; font-size: .78rem; line-height: 1.9; color: var(--muted); }.empty-note { font-size: .65rem; display: block; margin-top: 22px; color: var(--muted); opacity: .75; }
.case-section { margin-top: 29px; }.section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 14px; }.section-heading h2 { font-size: .87rem; margin: 0; font-weight: 550; }.section-heading > span { font-size: .62rem; color: var(--muted); }.case-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }.case-item { display: flex; align-items: center; gap: 16px; padding: 21px 18px; border: 1px solid var(--line); border-radius: 12px; color: var(--text); background: var(--surface); width: 100%; text-align: left; font: inherit; }.ready-case { cursor: pointer; transition: border-color .17s, background .17s; }.ready-case:hover { border-color: color-mix(in srgb, var(--accent) 60%, var(--line)); background: var(--surface-2); }.ready-case:disabled { opacity: .55; cursor: wait; }.case-number { display: grid; place-items: center; min-width: 39px; align-self: stretch; border-right: 1px solid var(--line); padding-right: 16px; color: var(--muted); font: .85rem ui-monospace, monospace; }.case-number svg { width: 21px; height: 21px; }.case-item-content { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 8px; }.case-meta { display: flex; flex-wrap: wrap; gap: 5px; color: var(--muted); font-size: .6rem; font-variant-numeric: tabular-nums; }.case-item-content strong { font-size: .91rem; line-height: 1.55; font-weight: 550; overflow-wrap: anywhere; }.case-subtitle { color: var(--muted); font-size: .66rem; line-height: 1.6; }.case-open { display: flex; align-items: center; gap: 8px; color: var(--accent); font-size: .67rem; }.case-open svg { width: 18px; height: 18px; }.locked-case { background: transparent; }.locked-case .case-item-content strong { color: var(--muted); font-size: .83rem; font-weight: 450; }.sealed-badge { font-size: .6rem; color: var(--muted); padding: 5px 7px; border-radius: 4px; background: var(--surface-2); white-space: nowrap; }.page-footnote { color: var(--muted); font-size: .67rem; text-align: center; margin: 26px 0 0; line-height: 1.8; }
@media (max-width: 470px) { .case-item { padding: 18px 12px; gap: 11px; }.case-number { min-width: 29px; padding-right: 10px; font-size: .74rem; }.case-open > span { display: none; }.sealed-badge { display: none; }.case-meta { font-size: .58rem; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
