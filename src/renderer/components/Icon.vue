<script setup lang="ts">
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 24 })

const paths: Record<string, string[]> = {
  gear: [
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z'
  ],
  help: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M9.5 9a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8v.5', 'M12 17h.01'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  fullscreen: ['M8 3H5a2 2 0 0 0-2 2v3', 'M16 3h3a2 2 0 0 1 2 2v3', 'M21 16v3a2 2 0 0 1-2 2h-3', 'M3 16v3a2 2 0 0 0 2 2h3'],
  slim: ['M8 9V4h5', 'M16 9V4h-5', 'M8 15v5h5', 'M16 15v5h-5'],
  pin: ['M12 17v5', 'M5 9a7 7 0 0 1 14 0c0 4-3 6-3 8H8c0-2-3-4-3-8Z'],
  undo: ['M9 14 4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
  reset: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  play: ['M8 5.5v13l11-6.5-11-6.5Z'],
  pause: ['M9 5v14', 'M15 5v14'],
  dice: ['M4 4h16v16H4z', 'M8.5 8.5h.01', 'M15.5 8.5h.01', 'M12 12h.01', 'M8.5 15.5h.01', 'M15.5 15.5h.01'],
  music: ['M9 18V6l10-2v12', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z', 'M19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z'],
  users: ['M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1', 'M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 19v-1a4 4 0 0 0-3-3.9'],
  download: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 21h16'],
  record: ['M4 5h16v14H4z', 'M8 9h8', 'M8 13h8', 'M8 17h4'],
  refresh: ['M21 12a9 9 0 0 1-15.5 6.2', 'M3 12a9 9 0 0 1 15.5-6.2', 'M21 4v5h-5', 'M3 20v-5h5']
}

const d = (): string[] => paths[props.name] ?? paths.help
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(p, i) in d()" :key="i" :d="p" />
  </svg>
</template>
