<script setup lang="ts">
defineProps<{ name: string; size?: number }>();
const paths: Record<string, string> = {
  seal: 'M4 7h16v13H4z M7 7V4h10v3 M8 12h8 M8 16h5',
  trial: 'M12 3v17 M5 6h14 M5 6l-3 7h6L5 6z M19 6l-3 7h6l-3-7z M7 21h10',
  archive: 'M3 4h18v4H3z M5 8v13h14V8 M9 12h6',
  stats: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  sun: 'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.4 1.4 M17.6 17.6L19 19 M5 19l1.4-1.4 M17.6 6.4L19 5 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
  settings: 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  close: 'M6 6l12 12 M6 18L18 6',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  check: 'M5 12l4 4L19 6',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 16v5h16v-5',
  shield: 'M12 3L4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3z M8 12l3 3 5-6',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
  info: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 11v6 M12 7h.01',
  offline: 'M4 8a13 13 0 0 1 16 0 M7 12a8 8 0 0 1 10 0 M10 16a3 3 0 0 1 4 0 M12 20h.01',
};
</script>

<template>
  <svg :width="size ?? 20" :height="size ?? 20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] ?? paths.info" /></svg>
</template>
