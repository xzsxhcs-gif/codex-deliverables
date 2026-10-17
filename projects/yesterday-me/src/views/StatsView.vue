<script setup lang="ts">
import { computed } from 'vue';
import type { Statistics } from '../domain/types';

const props = defineProps<{ stats: Statistics | null }>();
const weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
const shortWeekdays = ['一', '二', '三', '四', '五', '六', '日'];
const number = (value: number) => value.toLocaleString('zh-CN');
const accuracy = computed(() => props.stats?.accuracy == null ? '—' : props.stats.accuracy.toLocaleString('zh-CN', { maximumFractionDigits: 1 }));
const weekdayMaximum = computed(() => Math.max(1, ...(props.stats?.weekdayCounts ?? [])));
const busiest = computed(() => props.stats?.busiestWeekdays.map((index) => weekdays[index]).join('、') || '还没有开庭记录');
const certaintyCopy = computed(() => {
  const value = props.stats?.accuracy;
  if (value == null) return '明天的你，还没有给出答案。';
  if (value === 100) return '目前，昨天的你猜中了每一次。';
  if (value >= 70) return '你和昨天的你，默契尚可。';
  if (value >= 40) return '看来你对自己，保留了一点悬念。';
  return '明天的你，总能带来一点意外。';
});
const streakCopy = computed(() => {
  const value = props.stats?.forgiveStreak ?? 0;
  if (value === 0) return '和昨天握手，随时都来得及。';
  if (value === 1) return '这一次和解，已经计入档案。';
  return `连续 ${number(value)} 天握手言和。被告近期很安心。`;
});
const monthlyCopy = computed(() => {
  if (!props.stats?.trialsTotal) return '目前没有统计结论。先给明天留句话吧。';
  const count = props.stats.monthlyHiss;
  if (!count) return '本月尚未对自己哈气。庭内气氛暂时和平。';
  return `本月已对自己哈气 ${number(count)} 次。声音留在这里，日子继续过。`;
});
</script>

<template>
  <section class="stats-view" aria-labelledby="stats-heading" :aria-busy="stats === null">
    <header class="page-heading">
      <p class="section-label"><span aria-hidden="true"></span> 自我观察报告</p>
      <h1 id="stats-heading">你与自己的关系。</h1>
      <p class="heading-copy">数字只负责记录，不负责评判你。</p>
    </header>

    <div v-if="stats === null" class="stats-loading" role="status">
      <span class="loading-mark" aria-hidden="true"></span>
      正在整理本机档案……
    </div>

    <template v-else>
      <dl class="stat-ledger" aria-label="累计记录">
        <div><dt>累计封存</dt><dd>{{ number(stats.sealedTotal) }}<span>份</span></dd></div>
        <div><dt>累计审判</dt><dd>{{ number(stats.trialsTotal) }}<span>次</span></dd></div>
        <div><dt><span class="metric-dot forgive" aria-hidden="true"></span>无罪释放</dt><dd>{{ number(stats.forgiveTotal) }}<span>次</span></dd></div>
        <div><dt><span class="metric-dot hiss" aria-hidden="true"></span>对自己哈气</dt><dd>{{ number(stats.hissTotal) }}<span>次</span></dd></div>
      </dl>

      <div class="insight-grid">
        <section class="accuracy-panel" aria-labelledby="accuracy-heading">
          <div class="panel-heading"><h2 id="accuracy-heading">预测准确率</h2><span class="panel-index" aria-hidden="true">01 /</span></div>
          <div class="accuracy-data">
            <div>
              <p class="large-number">{{ accuracy }}<span v-if="stats.accuracy !== null">%</span></p>
              <p class="data-caption">{{ stats.predictedTotal ? `${number(stats.predictedTotal)} 次明确预测，猜中 ${number(stats.correctPredictions)} 次` : '尚无已审判的明确预测' }}</p>
            </div>
            <svg class="accuracy-orbit" viewBox="0 0 104 104" aria-hidden="true">
              <circle class="orbit-track" cx="52" cy="52" r="41" />
              <circle class="orbit-fill" cx="52" cy="52" r="41" pathLength="100" :stroke-dasharray="`${stats.accuracy ?? 0} 100`" />
              <path class="orbit-cross" d="M47 52h10m-5-5v10" />
              <path class="orbit-ticks" d="M52 3v5m49 44h-5M52 101v-5M3 52h5" />
            </svg>
          </div>
          <p class="insight-copy">{{ certaintyCopy }}</p>
          <p class="metric-note">“不好说”不参与准确率计算。</p>
        </section>

        <section class="streak-panel" aria-labelledby="streak-heading">
          <div class="panel-heading"><h2 id="streak-heading">连续原谅自己</h2><span class="panel-index" aria-hidden="true">02 /</span></div>
          <p class="large-number">{{ number(stats.forgiveStreak) }}<span>天</span></p>
          <p class="data-caption">按当地日历日计算</p>
          <p class="insight-copy">{{ streakCopy }}</p>
          <p class="metric-note">没有连续任务，也不必为了数字开庭。</p>
        </section>
      </div>

      <section class="weekday-panel" aria-labelledby="weekday-heading">
        <div class="weekday-heading">
          <div><p class="section-label">一周之内</p><h2 id="weekday-heading">哪天最爱开庭？</h2></div>
          <span class="chart-unit">单位 / 次</span>
        </div>
        <figure class="weekday-figure">
          <figcaption class="visually-hidden">全部已审判记录按判决时当地星期分布。</figcaption>
          <div class="weekday-chart" role="list" aria-label="每周审判次数">
            <div
              v-for="(label, index) in shortWeekdays"
              :key="label"
              class="weekday-column"
              :class="{ busiest: stats.busiestWeekdays.includes(index) }"
              role="listitem"
              :aria-label="`${weekdays[index]}，${stats.weekdayCounts[index] ?? 0} 次审判`"
            >
              <div class="bar-area" aria-hidden="true">
                <div class="weekday-bar" :style="{ height: `${((stats.weekdayCounts[index] ?? 0) / weekdayMaximum) * 100}%` }">
                  <span class="bar-value">{{ stats.weekdayCounts[index] ?? 0 }}</span>
                </div>
              </div>
              <span class="weekday-label" aria-hidden="true">{{ label }}</span>
            </div>
          </div>
        </figure>
        <div class="weekday-summary">
          <span>{{ stats.trialsTotal ? '最常开庭' : '暂无开庭日' }}</span>
          <p>{{ busiest }}</p>
        </div>
      </section>

      <aside class="monthly-note" aria-label="本月观察">
        <svg viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M6 3v4m10-4v4M4 9h14M4 5h14v14H4zM8 13h6m-6 3h3" /></svg>
        <p>{{ monthlyCopy }}</p>
      </aside>

      <details class="statistics-methods">
        <summary>这些数字如何计算？<span aria-hidden="true">＋</span></summary>
        <div class="methods-copy">
          <p><strong>预测准确率</strong>：已审判且明确选择“会原谅”或“会哈气”的记录中，预测与判决相符的比例。“不好说”不计入分母；没有明确预测时显示“—”。</p>
          <p><strong>连续原谅</strong>：一天至少有一次无罪释放、且没有哈气，才算和解日。按连续的当地日历日统计；今天尚未审判时从昨天接续，今天有哈气则归零。中间没有审判的日期会中断连续天数。</p>
          <p><strong>星期与本月</strong>：使用判决时记录的当地日期。“最常开庭”显示所有并列最多的星期；本月哈气按设备当前当地月份计算。</p>
        </div>
      </details>
    </template>
  </section>
</template>

<style scoped>
.stats-view { min-width: 0; }
.page-heading { padding-bottom: 30px; }
.section-label { display: flex; align-items: center; gap: 9px; color: var(--muted); font-size: 11px; letter-spacing: .16em; margin: 0 0 15px; }
.section-label > span { width: 5px; height: 5px; background: var(--accent); border-radius: 50%; }
h1 { margin: 0; font-size: clamp(27px, 4vw, 38px); line-height: 1.3; font-weight: 650; letter-spacing: -.045em; }
.heading-copy { color: var(--muted); font-size: 13px; line-height: 1.8; margin: 12px 0 0; }
.stats-loading { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 280px; border-block: 1px solid var(--line); font-size: 13px; color: var(--muted); }
.loading-mark { width: 13px; height: 13px; border: 1px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: rotate 1.2s linear infinite; }
.stat-ledger { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 0; padding: 28px 0; border-block: 1px solid var(--line); }
.stat-ledger > div { min-width: 0; padding: 0 23px; border-left: 1px solid var(--line); }
.stat-ledger > div:first-child { border: 0; padding-left: 0; }
.stat-ledger dt { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); white-space: nowrap; }
.stat-ledger dd { margin: 17px 0 0; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: clamp(28px, 3.2vw, 36px); letter-spacing: -.06em; line-height: 1; overflow-wrap: anywhere; }
.stat-ledger dd > span { margin-left: 6px; font-size: 10px; color: var(--muted); letter-spacing: 0; }
.metric-dot { width: 4px; height: 4px; border-radius: 50%; }
.metric-dot.forgive { background: var(--good); }
.metric-dot.hiss { background: var(--bad); }
.insight-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 0; margin-top: 29px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.accuracy-panel, .streak-panel { padding: 25px; min-width: 0; }
.streak-panel { border-left: 1px solid var(--line); }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
h2 { font-size: 14px; font-weight: 550; margin: 0; letter-spacing: -.015em; }
.panel-index { color: var(--muted); font-size: 10px; opacity: .6; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.accuracy-data { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
.accuracy-data > div { min-width: 0; }
.large-number { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: clamp(46px, 5.5vw, 62px); font-weight: 400; letter-spacing: -.075em; line-height: 1.1; margin: 28px 0 10px; overflow-wrap: anywhere; }
.large-number > span { margin-left: 7px; color: var(--muted); font-size: 18px; letter-spacing: -.03em; }
.data-caption { font-size: 10px; color: var(--muted); margin: 0; line-height: 1.8; }
.accuracy-orbit { width: 89px; height: 89px; margin-top: 20px; flex-shrink: 0; fill: none; }
.orbit-track { stroke: var(--line); stroke-width: 2; }
.orbit-fill { stroke: var(--accent); stroke-width: 2; transform: rotate(-90deg); transform-origin: center; }
.orbit-cross { stroke: var(--muted); stroke-width: 1; }
.orbit-ticks { stroke: var(--muted); stroke-width: 1; opacity: .4; }
.insight-copy { font-size: 12px; line-height: 1.9; margin: 24px 0 5px; }
.metric-note { color: var(--muted); font-size: 10px; line-height: 1.8; margin: 0; }
.weekday-panel { margin-top: 32px; padding-top: 2px; }
.weekday-heading { display: flex; justify-content: space-between; align-items: flex-end; }
.weekday-heading .section-label { margin-bottom: 9px; font-size: 9px; }
.weekday-heading h2 { font-size: 18px; }
.chart-unit { color: var(--muted); font-size: 9px; padding-bottom: 2px; }
.weekday-figure { margin: 0; }
.weekday-chart { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 14px; padding: 41px 9px 0; }
.weekday-column { min-width: 0; display: flex; flex-direction: column; align-items: center; }
.bar-area { position: relative; width: 100%; height: 121px; display: flex; align-items: flex-end; border-bottom: 1px solid var(--line); background: repeating-linear-gradient(to top, transparent 0, transparent 39px, var(--line) 40px, transparent 41px); }
.weekday-bar { width: 100%; max-width: 46px; margin: 0 auto; position: relative; background: var(--muted); opacity: .55; border-radius: 3px 3px 0 0; }
.busiest .weekday-bar { background: var(--accent); opacity: 1; }
.bar-value { position: absolute; bottom: calc(100% + 9px); left: 0; width: 100%; text-align: center; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 10px; color: var(--text); }
.weekday-label { margin-top: 11px; font-size: 10px; color: var(--muted); }
.busiest .weekday-label { color: var(--text); }
.weekday-summary { display: flex; align-items: baseline; gap: 20px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-top: 22px; padding: 17px 0; }
.weekday-summary > span { flex-shrink: 0; font-size: 10px; color: var(--muted); }
.weekday-summary p { font-size: 12px; line-height: 1.8; margin: 0; }
.monthly-note { display: flex; gap: 11px; align-items: flex-start; margin-top: 23px; color: var(--muted); }
.monthly-note svg { width: 20px; height: 20px; flex-shrink: 0; stroke: currentColor; stroke-width: 1; opacity: .7; }
.monthly-note p { margin: 0; font-size: 11px; line-height: 1.9; }
.statistics-methods { margin-top: 25px; color: var(--muted); }
.statistics-methods summary { display: flex; justify-content: space-between; align-items: center; font-size: 11px; cursor: pointer; list-style: none; padding: 14px 0; border-bottom: 1px solid var(--line); }
.statistics-methods summary::-webkit-details-marker { display: none; }
.statistics-methods summary > span { font-size: 16px; }
.statistics-methods[open] summary > span { transform: rotate(45deg); }
.statistics-methods summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
.methods-copy { padding-top: 6px; }
.methods-copy p { font-size: 11px; line-height: 1.95; margin: 13px 0; }
.methods-copy strong { font-weight: 500; color: var(--text); }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@keyframes rotate { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .page-heading { padding-bottom: 25px; }
  .heading-copy { font-size: 12px; }
  .stat-ledger { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 0; }
  .stat-ledger > div { padding: 22px 0 22px 20px; }
  .stat-ledger > div:first-child { padding: 22px 0; }
  .stat-ledger > div:nth-child(3) { border-left: 0; padding-left: 0; }
  .stat-ledger > div:nth-child(n + 3) { border-top: 1px solid var(--line); }
  .stat-ledger dd { font-size: 34px; margin-top: 13px; }
  .insight-grid { grid-template-columns: 1fr; margin-top: 23px; }
  .accuracy-panel, .streak-panel { padding: 23px; }
  .streak-panel { border-left: 0; border-top: 1px solid var(--line); }
  .large-number { margin-top: 23px; font-size: 56px; }
  .accuracy-orbit { width: 101px; height: 101px; margin-right: 2px; margin-top: 14px; }
  .insight-copy { margin-top: 18px; }
  .weekday-chart { gap: 10px; padding-inline: 0; }
  .bar-area { height: 105px; }
  .weekday-bar { max-width: 29px; }
  .weekday-summary { gap: 15px; }
}
@media (prefers-reduced-motion: reduce) { .loading-mark { animation: none; } }
</style>
