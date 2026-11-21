<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '../components/Icon.vue'
import { t } from '../i18n'

const expanded = ref(false)
const dragging = ref(false)
let startX = 0
let startY = 0
let lastX = 0
let lastY = 0
let moved = false
let downAt = 0

function onPointerDown(e: PointerEvent): void {
  if (expanded.value) return
  dragging.value = true
  moved = false
  downAt = Date.now()
  startX = lastX = e.screenX
  startY = lastY = e.screenY
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value) return
  const dx = e.screenX - lastX
  const dy = e.screenY - lastY
  if (Math.abs(e.screenX - startX) + Math.abs(e.screenY - startY) > 4) moved = true
  if (!moved) return
  lastX = e.screenX
  lastY = e.screenY
  window.extra.ballMove(dx, dy)
}

function onPointerUp(): void {
  if (!dragging.value) return
  dragging.value = false
  if (moved) {
    window.extra.ballSettle()
    return
  }
  if (Date.now() - downAt < 600) {
    expanded.value = true
    void window.api.ballExpand(true)
  }
}

function act(action: 'draw' | 'roll' | 'settings' | 'hide' | 'show'): void {
  expanded.value = false
  window.extra.ballAction(action)
}

function collapse(): void {
  expanded.value = false
  void window.api.ballExpand(false)
}

let off: (() => void) | null = null
onMounted(() => {
  off = window.extra.onBallState((s) => {
    expanded.value = s.expanded
  })
})
onBeforeUnmount(() => off?.())

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') collapse()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="ball-root" @contextmenu.prevent="collapse">
    <div v-if="!expanded" class="ball-hit">
      <button
        class="ball"
        title="轻触打开菜单 · 拖动可移动"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @lostpointercapture="onPointerUp"
      >
        <span class="ball-ring" />
        <Icon name="dice" />
      </button>
    </div>

    <div v-else class="ball-menu">
      <button class="menu-item p1" @click="act('draw')">
        <Icon name="dice" />
        <span>{{ t('ballDraw') }}</span>
      </button>
      <button class="menu-item p2" @click="act('roll')">
        <Icon name="play" />
        <span>{{ t('ballRoll') }}</span>
      </button>
      <button class="menu-item p3" @click="act('settings')">
        <Icon name="gear" />
        <span>{{ t('ballSettings') }}</span>
      </button>
      <button class="menu-item p4" @click="act('hide')">
        <Icon name="close" />
        <span>{{ t('ballHide') }}</span>
      </button>
      <button class="ball" @click="collapse">
        <Icon name="close" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.ball-hit {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
}
</style>
