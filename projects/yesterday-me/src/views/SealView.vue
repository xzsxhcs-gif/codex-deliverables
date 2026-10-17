<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import type { Prediction, SealInput } from '../domain/types';

const props = defineProps<{
  busy: boolean;
  lockedCount: number;
  readyCount: number;
  countdown: string;
  unlockLabel: string;
  successKey: number;
}>();
const emit = defineEmits<{ seal: [input: SealInput]; showReady: [] }>();
const draft = reactive({ title: '', content: '', defense: '', prediction: null as Prediction | null });
const attempted = ref(false);
const contentField = ref<HTMLTextAreaElement>();
const predictionGroup = ref<HTMLFieldSetElement>();
const predictions: { value: Prediction; symbol: string; title: string; detail: string }[] = [
  { value: 'forgive', symbol: '😇', title: '一定会原谅我', detail: '相信明天的宽容' },
  { value: 'hiss', symbol: '😾', title: '肯定会对我哈气', detail: '已预判明天的语气' },
  { value: 'unsure', symbol: '🤔', title: '不好说', detail: '未来的事少打听' },
];
const contentError = computed(() => attempted.value && !draft.content.trim());
const predictionError = computed(() => attempted.value && !draft.prediction);
watch(() => props.successKey, () => {
  Object.assign(draft, { title: '', content: '', defense: '', prediction: null });
  attempted.value = false;
});

async function submit() {
  if (props.busy) return;
  attempted.value = true;
  if (contentError.value || predictionError.value) {
    await nextTick();
    if (contentError.value) contentField.value?.focus();
    else predictionGroup.value?.querySelector<HTMLInputElement>('input')?.focus();
    return;
  }
  emit('seal', {
    title: draft.title.trim(), content: draft.content.trim(), defense: draft.defense.trim(),
    prediction: draft.prediction!,
  });
}
</script>

<template>
  <section class="seal-view page-view" aria-labelledby="seal-heading">
    <header class="page-heading seal-heading">
      <div class="eyebrow"><span class="live-dot" aria-hidden="true"></span> 跨时空自我审判系统</div>
      <h1 id="seal-heading">把今天，<br /><span>留给明天。</span></h1>
      <p>昨天的你负责留下线索。<br class="mobile-break" />明天的你，拥有最终解释权。</p>
    </header>

    <div class="time-card">
      <div class="time-card-label">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>
        <span>{{ lockedCount ? '下一批证据解锁' : '今天封存，明日解锁' }}</span>
      </div>
      <div class="time-card-main"><strong class="countdown">{{ countdown }}</strong><span class="time-unit">后</span></div>
      <div class="time-card-foot"><span>{{ unlockLabel }}</span><span class="locked-total">{{ lockedCount }} 份封存中</span></div>
    </div>

    <button v-if="readyCount" class="ready-banner" type="button" @click="emit('showReady')">
      <span class="ready-icon" aria-hidden="true">↗</span>
      <span><strong>{{ readyCount }} 份昨日证据，可以拆封了</strong><small>昨天的你已离线，无法接受申诉。</small></span>
      <span class="ready-arrow" aria-hidden="true">→</span>
    </button>

    <form class="seal-form surface-card" novalidate @submit.prevent="submit">
      <div class="form-heading"><div><span class="eyebrow">新的时间胶囊</span><h2>提交今日证据</h2></div><span class="draft-badge">未封存</span></div>

      <div class="form-field">
        <div class="field-heading"><label for="capsule-title">证据标题 <span class="optional">选填</span></label><span class="field-count">{{ draft.title.length }}/60</span></div>
        <input id="capsule-title" v-model="draft.title" :disabled="busy" maxlength="60" placeholder="给这件小事起个名字" autocomplete="off" />
      </div>

      <div class="form-field">
        <div class="field-heading"><label for="capsule-content">给明天的留言 <span class="required-label">必填</span></label><span id="content-count" class="field-count">{{ draft.content.length }}/5000</span></div>
        <textarea id="capsule-content" ref="contentField" v-model="draft.content" :disabled="busy" rows="5" maxlength="5000" placeholder="今天的计划、小小的决定，或一句明天才想听见的话……" :aria-invalid="contentError" :aria-describedby="contentError ? 'content-error content-count' : 'content-count'" />
        <p v-if="contentError" id="content-error" class="field-error" role="alert">先给明天的自己留句话吧。</p>
      </div>

      <fieldset ref="predictionGroup" class="prediction-field" :disabled="busy" :aria-describedby="predictionError ? 'prediction-error prediction-hint' : 'prediction-hint'">
        <legend>你认为明天的自己会如何评价这件事？</legend>
        <div class="prediction-options">
          <label v-for="option in predictions" :key="option.value" class="prediction-option" :class="{ selected: draft.prediction === option.value }">
            <input v-model="draft.prediction" type="radio" name="prediction" :value="option.value" :aria-invalid="predictionError" />
            <span class="prediction-symbol" aria-hidden="true">{{ option.symbol }}</span>
            <span class="prediction-copy"><strong>{{ option.title }}</strong><small>{{ option.detail }}</small></span>
            <span class="radio-indicator" aria-hidden="true"></span>
          </label>
        </div>
        <p v-if="predictionError" id="prediction-error" class="field-error" role="alert">选一个预测。拿不准，也是一种答案。</p>
        <p id="prediction-hint" class="field-hint">答案一起封存，审判完成后再揭晓。</p>
      </fieldset>

      <div class="form-field defense-field">
        <div class="field-heading"><label for="capsule-defense">昨日辩护词 <span class="optional">选填</span></label><span id="defense-count" class="field-count">{{ draft.defense.length }}/1000</span></div>
        <textarea id="capsule-defense" v-model="draft.defense" :disabled="busy" rows="3" maxlength="1000" placeholder="比如：虽然多买了一杯，但当时的快乐也是真的。" aria-describedby="defense-count" />
      </div>

      <div class="seal-footer">
        <p><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></svg><span>封存后暂时无法查看或修改，<br />明天当地时间 00:00 起可打开。</span></p>
        <button class="primary-button seal-submit" type="submit" :disabled="busy"><span>{{ busy ? '正在封存…' : '封存证据' }}</span><span aria-hidden="true">↗</span></button>
      </div>
    </form>
    <p class="page-footnote">生活不是考试。这只是你和自己的隔日玩笑。</p>
  </section>
</template>

<style scoped>
.seal-heading h1 { margin: 17px 0 16px; font-size: clamp(2.45rem, 5.1vw, 3.7rem); line-height: 1.12; letter-spacing: -.06em; font-weight: 650; }
.seal-heading h1 span { color: var(--muted); }
.seal-heading > p { color: var(--muted); font-size: .95rem; line-height: 1.8; }
.eyebrow { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: .7rem; font-weight: 600; letter-spacing: .13em; }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 10%, transparent); }
.time-card { border: 1px solid var(--line); border-radius: 16px; padding: 20px 23px 16px; margin: 28px 0 22px; position: relative; overflow: hidden; background: linear-gradient(105deg, var(--surface-2), var(--surface)); }
.time-card::after { content: ''; position: absolute; right: -60px; top: -100px; width: 260px; height: 260px; border: 1px solid var(--line); border-radius: 50%; pointer-events: none; }
.time-card-label { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: .76rem; }
.time-card-label svg { width: 15px; height: 15px; }
.time-card-main { display: flex; align-items: baseline; gap: 10px; margin: 8px 0 12px; }
.countdown { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-variant-numeric: tabular-nums; font-size: clamp(2rem, 7vw, 2.7rem); letter-spacing: -.06em; font-weight: 450; line-height: 1.25; }
.time-unit { color: var(--muted); font-size: .7rem; }
.time-card-foot { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; font-size: .68rem; color: var(--muted); }
.locked-total { color: var(--text); }
.ready-banner { width: 100%; display: flex; gap: 13px; align-items: center; text-align: left; padding: 16px; border-radius: 12px; margin-bottom: 20px; border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--line)); background: color-mix(in srgb, var(--accent) 7%, var(--surface)); color: var(--text); cursor: pointer; }
.ready-icon { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
.ready-banner strong, .ready-banner small { display: block; }
.ready-banner strong { font-size: .83rem; font-weight: 600; }.ready-banner small { margin-top: 5px; color: var(--muted); font-size: .69rem; }.ready-arrow { margin-left: auto; color: var(--accent); }
.seal-form { padding: 26px; border: 1px solid var(--line); border-radius: 18px; background: var(--surface); }
.form-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }.form-heading h2 { font-size: 1.24rem; letter-spacing: -.035em; margin: 8px 0 0; font-weight: 600; }.form-heading .eyebrow { font-size: .63rem; }
.draft-badge { color: var(--muted); font-size: .65rem; padding: 5px 8px; border: 1px solid var(--line); border-radius: 5px; }
.form-field { margin-bottom: 23px; }.field-heading { display: flex; justify-content: space-between; gap: 8px; align-items: center; margin-bottom: 10px; }.field-heading label, .prediction-field legend { color: var(--text); font-size: .81rem; font-weight: 550; }.optional, .required-label { color: var(--muted); font-weight: 400; font-size: .64rem; margin-left: 6px; }.required-label { color: var(--accent); }.field-count { color: var(--muted); font-size: .65rem; font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; }
input:not([type='radio']), textarea { width: 100%; border: 1px solid var(--line); border-radius: 9px; padding: 13px 14px; background: var(--bg); color: var(--text); font: inherit; font-size: .88rem; line-height: 1.75; transition: border-color .15s, box-shadow .15s; }
input::placeholder, textarea::placeholder { color: var(--muted); opacity: .68; } textarea { display: block; resize: vertical; min-height: 90px; } input:focus-visible, textarea:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent); } [aria-invalid='true']:not(fieldset) { border-color: var(--bad); }
.field-error { font-size: .75rem; color: var(--bad); margin: 7px 0 0; }.field-hint { color: var(--muted); font-size: .68rem; margin: 10px 0 0; }
.prediction-field { border: 0; padding: 0; margin: 4px 0 25px; min-width: 0; }.prediction-field legend { padding: 0; margin-bottom: 13px; line-height: 1.6; }.prediction-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.prediction-option { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 9px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg); padding: 14px 11px; cursor: pointer; transition: background .15s, border-color .15s; }.prediction-option.selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 7%, var(--bg)); }.prediction-option:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 3px; }.prediction-option input { position: absolute; width: 1px; height: 1px; opacity: 0; }.prediction-symbol { font-size: 1.2rem; line-height: 1; }.prediction-copy strong { display: block; font-size: .73rem; font-weight: 500; line-height: 1.55; }.prediction-copy small { display: block; margin-top: 3px; font-size: .59rem; color: var(--muted); line-height: 1.6; }.radio-indicator { position: absolute; right: 10px; top: 13px; width: 10px; height: 10px; border: 1px solid var(--line); border-radius: 50%; }.selected .radio-indicator { border-color: var(--accent); background: var(--accent); box-shadow: inset 0 0 0 2px var(--bg); }
.seal-footer { display: flex; justify-content: space-between; align-items: center; gap: 20px; border-top: 1px solid var(--line); padding-top: 20px; }.seal-footer p { display: flex; align-items: flex-start; gap: 8px; margin: 0; font-size: .67rem; color: var(--muted); line-height: 1.75; }.seal-footer svg { flex-shrink: 0; width: 15px; height: 15px; margin-top: 3px; }.seal-submit { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 24px; min-height: 46px; padding: 12px 20px; border: 1px solid var(--accent); border-radius: 9px; color: #14110d; background: var(--accent); font: inherit; font-size: .82rem; font-weight: 650; cursor: pointer; }.seal-submit:disabled { opacity: .55; cursor: wait; }.page-footnote { margin: 20px 0 0; text-align: center; color: var(--muted); font-size: .67rem; line-height: 1.8; }
@media (min-width: 650px) { .mobile-break { display: none; } }
@media (max-width: 470px) { .seal-form { padding: 20px 16px; }.seal-footer { align-items: stretch; flex-direction: column; gap: 16px; }.seal-submit { justify-content: center; }.prediction-option { padding: 13px 8px; }.prediction-copy strong { font-size: .69rem; }.prediction-copy small { font-size: .56rem; }.time-card { padding: 18px; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
</style>
