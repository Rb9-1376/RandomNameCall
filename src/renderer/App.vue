<script setup lang="ts">
import { computed, onMounted, watchEffect } from 'vue'
import MainView from './views/MainView.vue'
import BallView from './views/BallView.vue'
import { effective, init, ready, runtime } from './composables/useApp'
import { setLang, dirOf } from './i18n'

const isBall = location.hash.startsWith('#/ball')

const ui = computed(() => effective.value?.ui)
const density = computed(() => {
  const u = ui.value
  if (!u) return 'normal'
  if (u.density !== 'auto') return u.density
  return runtime.value?.density ?? 'normal'
})

/** 屏幕密度系数：用户的 0.8–1.6 是"在这块屏上再微调"，4K 不必手动拉到 1.6 */
const DENSITY_FACTOR: Record<string, number> = {
  compact: 1,
  normal: 1,
  comfort: 1.15,
  large: 1.4
}

watchEffect(() => {
  const el = document.documentElement
  const base = ui.value?.uiScale ?? 1
  const factor = DENSITY_FACTOR[density.value] ?? 1
  el.style.setProperty('--ui-scale', (base * factor).toFixed(3))
  el.dataset.theme = ui.value?.theme ?? 'light'
  el.dataset.density = density.value
  // 低配模式：关毛玻璃/重动画/渐变
  el.dataset.perf = ui.value?.perfMode ? '1' : ''
  // 语言：文案 + 方向（阿拉伯语/维吾尔语 RTL）+ 蒙古文姓名竖排标记
  const lang = ui.value?.lang ?? 'zh'
  setLang(lang)
  el.lang = lang
  el.dataset.lang = lang
  el.dir = dirOf(lang)
})

onMounted(async () => {
  if (isBall) {
    await window.api.getState()
  } else {
    await init()
  }
})
</script>

<template>
  <MainView v-if="!isBall && ready" />
  <BallView v-else-if="isBall" />
</template>
