<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { CaseFile, Outcome, Prediction } from '../domain/types';
import { pickRemark } from '../domain/humor';
const props = defineProps<{ caseFile: CaseFile; busy: boolean; animateVerdict: boolean }>();
const emit = defineEmits<{ judge: [verdict: { id: string; outcome: Outcome }] }>();
const defenseRead = ref(props.caseFile.status === 'judged');
const judgmentRemark = ref(pickRemark('judged'));
const defensePanel = ref<HTMLElement>();
const number = computed(() => String(props.caseFile.caseNumber).padStart(3, '0'));
const predictions: Record<Prediction, string> = {
  forgive: '😇 一定会原谅我', hiss: '😾 肯定会对我哈气', unsure: '🤔 不好说，未来的事少打听',
};
const predictionComment = computed(() => {
  const file = props.caseFile;
  if (file.status !== 'judged') return '';
  if (file.prediction === 'unsure') return '昨日保留意见。未来的事，确实不好说。这次不计入准确率。';
  if (file.verdict.predictionMatched) return file.verdict.outcome === 'hiss' ? '预测成功。你准确预见了今天这一声哈气。' : '预测成功。你预见了自己会温柔一点。';
  return '预测失误。时隔一天，陪审团换了想法。';
});
watch(() => props.caseFile.id, () => { defenseRead.value = props.caseFile.status === 'judged'; judgmentRemark.value = pickRemark('judged'); });

async function revealDefense() {
  defenseRead.value = true;
  await nextTick();
  defensePanel.value?.focus({ preventScroll: true });
}
function judge(outcome: Outcome) {
  if (!props.busy && defenseRead.value && props.caseFile.status === 'ready') {
    emit('judge', { id: props.caseFile.id, outcome });
  }
}
</script>

<template>
  <article class="case-detail" :aria-busy="busy">
    <header class="case-detail-header">
      <div class="detail-eyebrow"><span>{{ caseFile.sealedDate }} / 第 {{ number }} 号案件</span><span class="detail-state" :class="{ finished: caseFile.status === 'judged' }">{{ caseFile.status === 'judged' ? '已归档' : '审理中' }}</span></div>
      <h2 id="case-detail-title">{{ caseFile.title }}</h2>
      <p>来自昨日的你。由今日的你亲自查阅。</p>
    </header>

    <section class="evidence-block" aria-labelledby="message-heading">
      <h3 id="message-heading"><span class="evidence-number">01</span> 原始留言<span class="unchanged-label">封存原件</span></h3>
      <div class="evidence-paper"><span class="quote-mark" aria-hidden="true">“</span><p class="evidence-text">{{ caseFile.content }}</p></div>
    </section>

    <div v-if="!defenseRead && caseFile.status === 'ready'" class="defense-reveal">
      <p>在下结论之前，还有一份昨日递交的材料。</p>
      <button class="secondary-button reveal-button" type="button" :disabled="busy" @click="revealDefense"><span>展开昨日辩护词</span><span aria-hidden="true">↓</span></button>
    </div>

    <section v-if="defenseRead || caseFile.status === 'judged'" ref="defensePanel" class="evidence-block defense-block" aria-labelledby="defense-heading" tabindex="-1">
      <h3 id="defense-heading"><span class="evidence-number">02</span> 昨日辩护词</h3>
      <div class="defense-paper"><p v-if="caseFile.defense" class="evidence-text">{{ caseFile.defense }}</p><p v-else class="no-defense">昨日的你没有留下辩护词。<br />沉默也是被允许的。</p></div>
      <p class="system-aside">被告的辩护材料已提交。</p>
    </section>

    <section v-if="caseFile.status === 'ready' && defenseRead" class="judgment-section" aria-labelledby="judgment-heading">
      <h3 id="judgment-heading"><span class="evidence-number">03</span> 今日判决</h3>
      <p class="judgment-note">认真走个形式，不必认真责备自己。</p>
      <div class="judgment-actions">
        <button type="button" class="judgment-button forgive-button" :disabled="busy" @click="judge('forgive')"><span class="judgment-symbol" aria-hidden="true">😇</span><strong>无罪释放</strong><span>就这样吧，放过自己</span></button>
        <button type="button" class="judgment-button hiss-button" :disabled="busy" @click="judge('hiss')"><span class="judgment-symbol" aria-hidden="true">😾</span><strong>对自己哈气</strong><span>表达一下，仅此而已</span></button>
      </div>
      <p class="verdict-caution">{{ busy ? '正在记录判决…' : '提交后将永久归档，无法更改。昨天的预测随后揭晓。' }}</p>
    </section>

    <section v-if="caseFile.status === 'judged'" class="verdict-section" aria-labelledby="verdict-heading" aria-live="polite">
      <div class="verdict-card" :class="[caseFile.verdict.outcome, { 'verdict-animate': animateVerdict }]">
        <div class="verdict-stamp" aria-hidden="true"><svg v-if="caseFile.verdict.outcome === 'forgive'" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="20" cy="20" r="16" /><path d="m12 20 5 5 11-11" /></svg><svg v-else viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 29V13l7 5a18 18 0 0 1 10 0l7-5v16c-7 6-17 6-24 0Z" /><path d="m13 23 4 1m10-1-4 1m-5 5h4M5 22H1m38 0h-4M6 16l-3-2m34 0-3 2" /></svg></div>
        <span class="verdict-kicker">{{ caseFile.verdict.judgedDate }} / 判决生效</span>
        <h3 id="verdict-heading">{{ caseFile.verdict.outcome === 'forgive' ? '本庭宣布，被告无罪。' : '哈————！！！' }}</h3>
        <p>{{ caseFile.verdict.outcome === 'forgive' ? '昨日的你已被温柔放行。' : '昨日的你已被严厉警告。' }}</p>
        <span class="verdict-footnote">{{ caseFile.verdict.outcome === 'forgive' ? '今天，请继续好好生活。' : '仪式结束。不扣分，也不影响你继续快乐。' }}</span>
      </div>

      <div class="prediction-result"><div class="prediction-result-heading"><h3>昨日的预测</h3><span class="prediction-result-tag" :class="{ matched: caseFile.verdict.predictionMatched === true }">{{ caseFile.prediction === 'unsure' ? '保留意见' : caseFile.verdict.predictionMatched ? '预测成功' : '剧情有变' }}</span></div><p class="original-prediction">{{ predictions[caseFile.prediction] }}</p><p class="prediction-comment">{{ predictionComment }}</p></div>
      <p class="record-final-note">本案已归档，可随时回看。<br />{{ judgmentRemark }}</p>
    </section>
  </article>
</template>

<style scoped>
.case-detail { color: var(--text); }.detail-eyebrow { display: flex; justify-content: space-between; align-items: center; gap: 12px; color: var(--muted); font-size: .63rem; font-variant-numeric: tabular-nums; line-height: 1.7; }.detail-state { white-space: nowrap; padding: 3px 7px; border: 1px solid color-mix(in srgb, var(--accent) 32%, transparent); border-radius: 4px; color: var(--accent); font-size: .61rem; }.detail-state.finished { color: var(--muted); border-color: var(--line); }.case-detail-header h2 { margin: 19px 0 10px; font-size: 1.6rem; line-height: 1.4; letter-spacing: -.04em; font-weight: 600; overflow-wrap: anywhere; }.case-detail-header > p { margin: 0 0 28px; color: var(--muted); font-size: .74rem; line-height: 1.8; }
.evidence-block { margin-top: 26px; }.evidence-block h3, .judgment-section > h3 { display: flex; align-items: center; gap: 10px; font-size: .8rem; font-weight: 550; margin: 0 0 13px; }.evidence-number { font-family: ui-monospace, monospace; font-size: .65rem; color: var(--muted); }.unchanged-label { font-size: .58rem; font-weight: 400; color: var(--muted); margin-left: auto; }.evidence-paper { position: relative; padding: 28px 21px 22px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); }.quote-mark { position: absolute; top: 5px; left: 12px; color: var(--accent); opacity: .32; font-family: Georgia, serif; font-size: 3rem; line-height: 1; }.evidence-text { position: relative; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: .91rem; line-height: 1.95; }.defense-reveal { margin: 22px 0 0; }.defense-reveal > p { color: var(--muted); font-size: .73rem; line-height: 1.8; }.reveal-button { display: flex; justify-content: space-between; align-items: center; gap: 20px; width: 100%; padding: 14px 16px; color: var(--text); background: transparent; border: 1px solid var(--line); border-radius: 9px; font: inherit; font-size: .78rem; cursor: pointer; }.reveal-button:hover { background: var(--surface-2); border-color: var(--muted); }.reveal-button > span:last-child { color: var(--accent); }.defense-block:focus { outline: none; }.defense-paper { border-left: 2px solid color-mix(in srgb, var(--accent) 48%, var(--line)); padding: 5px 0 5px 18px; }.defense-paper .evidence-text { font-size: .83rem; color: var(--muted); }.no-defense { font-size: .81rem; color: var(--muted); line-height: 1.8; margin: 0; }.system-aside { font-size: .63rem; color: var(--muted); margin-top: 13px; }
.judgment-section { border-top: 1px solid var(--line); padding-top: 23px; margin-top: 25px; }.judgment-note { font-size: .73rem; color: var(--muted); margin: 0 0 17px; }.judgment-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }.judgment-button { padding: 19px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 11px; background: var(--surface-2); color: var(--text); cursor: pointer; transition: transform .16s, border-color .16s; font: inherit; }.judgment-button:hover { transform: translateY(-2px); }.judgment-button:disabled { opacity: .5; cursor: wait; transform: none; }.forgive-button:hover { border-color: var(--good); }.hiss-button { border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); background: color-mix(in srgb, var(--accent) 6%, var(--surface)); }.hiss-button:hover { border-color: var(--accent); }.judgment-symbol { font-size: 1.5rem; margin-bottom: 3px; }.judgment-button strong { font-size: .87rem; font-weight: 600; }.judgment-button > span:last-child { font-size: .64rem; color: var(--muted); }.verdict-caution { font-size: .62rem; text-align: center; color: var(--muted); line-height: 1.8; margin: 15px 0 0; }
.verdict-section { margin-top: 27px; border-top: 1px solid var(--line); padding-top: 25px; }.verdict-card { text-align: center; border: 1px solid var(--line); border-radius: 12px; padding: 24px 17px; background: var(--surface-2); overflow: hidden; }.verdict-card.forgive { border-color: color-mix(in srgb, var(--good) 27%, var(--line)); }.verdict-card.hiss { border-color: color-mix(in srgb, var(--accent) 30%, var(--line)); }.verdict-stamp { width: 44px; height: 44px; margin: 0 auto 13px; color: var(--good); }.verdict-stamp svg { width: 100%; height: 100%; }.hiss .verdict-stamp { color: var(--accent); }.verdict-kicker { font-size: .61rem; color: var(--muted); font-variant-numeric: tabular-nums; }.verdict-card h3 { font-size: 1.13rem; font-weight: 600; margin: 14px 0 10px; letter-spacing: -.025em; line-height: 1.65; }.verdict-card > p { font-size: .78rem; color: var(--muted); margin: 0; }.verdict-footnote { display: block; color: var(--muted); font-size: .62rem; margin-top: 18px; line-height: 1.8; }.prediction-result { margin-top: 18px; padding: 18px; border: 1px solid var(--line); border-radius: 10px; }.prediction-result-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.prediction-result h3 { margin: 0; font-size: .74rem; font-weight: 500; }.prediction-result-tag { color: var(--muted); font-size: .6rem; background: var(--surface-2); padding: 4px 6px; border-radius: 4px; }.prediction-result-tag.matched { color: var(--good); }.original-prediction { font-size: .82rem; margin: 15px 0 10px; }.prediction-comment { font-size: .72rem; color: var(--muted); line-height: 1.9; margin: 0; }.record-final-note { color: var(--muted); font-size: .62rem; text-align: center; line-height: 1.9; margin: 19px 0 0; }
.verdict-animate.forgive .verdict-stamp { animation: soft-release .65s ease-out; }.verdict-animate.hiss .verdict-stamp { animation: restrained-hiss .5s ease-out; }.verdict-animate { animation: verdict-arrive .3s ease-out; }@keyframes soft-release { from { transform: translateY(9px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }@keyframes restrained-hiss { 0% { transform: scale(.9); opacity: .1; } 35% { transform: scale(1.08) rotate(-4deg); opacity: 1; } 65% { transform: rotate(3deg); } 100% { transform: scale(1) rotate(0); } }@keyframes verdict-arrive { from { opacity: .15; } to { opacity: 1; } }
@media (max-width: 400px) { .judgment-actions { gap: 8px; }.judgment-button { padding: 17px 8px; }.judgment-button > span:last-child { font-size: .58rem; }.evidence-paper { padding-left: 16px; padding-right: 16px; }.case-detail-header h2 { font-size: 1.4rem; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; transform: none !important; } }
</style>
