<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, useId } from 'vue';
import Icon from './Icon.vue';
const props = withDefaults(defineProps<{ title: string; eyebrow?: string; dismissable?: boolean; wide?: boolean; notice?: { message: string; kind: 'success' | 'error' } | null }>(), { dismissable: true, wide: false, notice: null });
const emit = defineEmits<{ close: []; dismissNotice: [] }>();
const dialog = ref<HTMLDialogElement>();
const titleId = useId();
let previous: HTMLElement | null = null;
let overflow = '';
function requestClose() { if (props.dismissable) emit('close'); }
function outside(event: MouseEvent) {
  if (event.target !== dialog.value || !dialog.value) return;
  const r = dialog.value.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) requestClose();
}
onMounted(() => {
  previous = document.activeElement as HTMLElement;
  overflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  dialog.value?.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  document.body.style.overflow = overflow;
  if (previous?.isConnected) previous.focus({ preventScroll: true });
});
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" :aria-labelledby="titleId" class="modal" :class="{ 'modal-wide': wide }" @cancel.prevent="requestClose" @click="outside">
      <header class="modal-header">
        <div><span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span><h2 :id="titleId">{{ title }}</h2></div>
        <button v-if="dismissable" class="icon-button" type="button" aria-label="关闭对话框" @click="requestClose"><Icon name="close" /></button>
        <div v-if="notice" class="modal-notice" :class="notice.kind" :role="notice.kind === 'error' ? 'alert' : 'status'"><span>{{ notice.message }}</span><button class="icon-button" type="button" aria-label="关闭提示" @click="emit('dismissNotice')"><Icon name="close" :size="15" /></button></div>
      </header>
      <div class="modal-content"><slot /></div>
    </dialog>
  </Teleport>
</template>
