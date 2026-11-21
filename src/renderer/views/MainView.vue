<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { THEME_PALETTE } from '@shared/theme'
import type { NameAudit } from '@shared/types'
import Icon from '../components/Icon.vue'
import SettingsDrawer from '../components/SettingsDrawer.vue'
import InfoModal from '../components/InfoModal.vue'
import AuditModal from '../components/AuditModal.vue'
import Wizard from '../components/Wizard.vue'
import {
  activeClass,
  bumpWeight,
  displayName,
  draw,
  effective,
  lastResult,
  lastWeight,
  patch,
  popKey,
  pushToast,
  ready,
  refreshState,
  remaining,
  resetPool,
  rolling,
  setClass,
  startBgm,
  state,
  stopBgm,
  toggleRoll,
  total,
  undo,
  updateInfo,
  updateProgress,
  updateDownloaded,
  toasts
} from '../composables/useApp'
import { t } from '../i18n'

const ui = computed(() => effective.value!.ui)
const cls = computed(() => activeClass.value)

const drawerOpen = ref(false)
const drawerFocus = ref<string | undefined>(undefined)
const info = ref<{ title: string; body: string } | null>(null)
const classMenu = ref(false)
const bgmOn = ref(false)

const boxRef = ref<HTMLElement | null>(null)
const nameRef = ref<HTMLElement | null>(null)
const fitSize = ref(220)

const shellStyle = computed(() => ({
  '--bg': ui.value.background,
  '--btn-bg': ui.value.buttonbg,
  '--name-color': ui.value.nameColor
}))

const showWeight = computed(() => lastWeight.value > 1 && Boolean(lastResult.value))

async function fit(): Promise<void> {
  const box = boxRef.value
  if (!box) return
  const u = ui.value
  const maxW = box.clientWidth * 0.94
  const maxH = box.clientHeight * 0.94
  if (!u.autoFit || maxW <= 0 || maxH <= 0) {
    fitSize.value = u.fontSize
    return
  }
  // 先给到屏高能容纳的上限，再按 94% 步进收缩，直到真实渲染尺寸不溢出
  let size = Math.max(24, Math.min(u.fontSize, maxH))
  for (let i = 0; i < 18; i++) {
    fitSize.value = size
    await nextTick()
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    const el = nameRef.value
    if (!el) return
    if (el.scrollWidth <= maxW && el.scrollHeight <= maxH) break
    size = Math.floor(size * 0.94)
    if (size <= 24) {
      size = 24
      break
    }
  }
  fitSize.value = size
}

watch(
  [displayName, popKey, () => ui.value.fontSize, () => ui.value.autoFit, () => ui.value.fontFamily, () => ui.value.density],
  () => void fit()
)
watch(drawerOpen, () => requestAnimationFrame(fit))

let boxObserver: ResizeObserver | null = null
let offOpenSettings: (() => void) | null = null

onMounted(() => {
  window.addEventListener('resize', fit)
  void fit()
  if (boxRef.value && 'ResizeObserver' in window) {
    boxObserver = new ResizeObserver(() => void fit())
    boxObserver.observe(boxRef.value)
  }
  // 悬浮球"设置"菜单：显示主窗口并打开设置抽屉
  offOpenSettings = window.extra.onOpenSettings(() => openSettings())
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
  boxObserver?.disconnect()
  offOpenSettings?.()
})

/* ---------------- 长按 600ms = 设置（触摸屏没有右键） ---------------- */
let longTimer: ReturnType<typeof setTimeout> | null = null
function pressStart(): void {
  if (longTimer) clearTimeout(longTimer)
  longTimer = setTimeout(() => {
    longTimer = null
    openSettings()
  }, 600)
}
function pressEnd(): void {
  if (longTimer) {
    clearTimeout(longTimer)
    longTimer = null
  }
}

/* ---------------- 快捷键 ---------------- */
function isTyping(e: Event): boolean {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
}

function onKey(e: KeyboardEvent): void {
  // 全屏时 Esc 优先退出全屏（kiosk 场景最常用）
  if (e.key === 'Escape' && ui.value.fullscreen) {
    void window.api.setFullscreen(false)
    return
  }
  if (isTyping(e) || drawerOpen.value || info.value) {
    if (e.key === 'Escape') {
      if (info.value) info.value = null
      else if (drawerOpen.value) drawerOpen.value = false
    }
    return
  }
  if (e.code === 'Space') {
    e.preventDefault()
    void toggleRoll()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    void draw()
  } else if (e.key === 'F11') {
    e.preventDefault()
    void toggleFullscreen()
  } else if (e.key === 'Escape') {
    if (rolling.value) void toggleRoll()
  } else if (e.key.toLowerCase() === 's') {
    openSettings()
  } else if (e.key.toLowerCase() === 'h') {
    openHelp()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    void undo()
  } else if (e.key === 'PageUp' || e.key === 'PageDown') {
    e.preventDefault()
    void toggleRoll()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function openSettings(section?: string): void {
  drawerOpen.value = true
  drawerFocus.value = section
  classMenu.value = false
}

function openHelp(): void {
  info.value = {
    title: t('helpTitle'),
    body: t('helpBody')
  }
}

function openEncodingHelp(): void {
  info.value = {
    title: t('encodingHelp'),
    body: t('encodingBody')
  }
}

function minimize(): void {
  void window.api.minimize()
}

async function toggleFullscreen(): Promise<void> {
  await patch({ ui: { ...ui.value, fullscreen: !ui.value.fullscreen } })
}

function quit(): void {
  window.extra.flush()
  void window.api.quit()
}

function openReleases(): void {
  void window.api.openExternal('https://github.com/Rb9-1376/RandomNameCall/releases')
}

const updatePct = computed(() => {
  const p = updateProgress.value
  if (!p || !p.total) return 0
  return Math.min(100, Math.round((p.received / p.total) * 100))
})

/** 方案一：一键更新 —— 后台下载（进度条）→ 自动启动安装程序 */
async function onDownloadUpdate(): Promise<void> {
  if (updateProgress.value) return
  const path = await window.api.downloadUpdate()
  if (path) {
    pushToast('下载完成，正在启动安装程序…')
    await window.api.installUpdate(path)
  }
}

/** 方案二：打开 GitHub 下载页手动下载 */
async function onOpenRelease(): Promise<void> {
  await window.api.openReleasePage()
}

function toggleBgm(): void {
  bgmOn.value = !bgmOn.value
  if (bgmOn.value) startBgm()
  else stopBgm()
}

async function pickBgm(): Promise<void> {
  const file = await window.api.pickBgm()
  if (!file) return
  const s = state.value!
  await patch({ sound: { ...s.sound, bgmFile: file, bgm: s.sound.bgm || 0.4 } })
  pushToast('已设置背景音乐')
}

async function onSave(next: typeof state.value): Promise<void> {
  if (!next) return
  await patch({
    ui: next.ui,
    roll: next.roll,
    sound: next.sound,
    net: next.net,
    update: next.update,
    ball: next.ball,
    classes: next.classes
  })
  drawerOpen.value = false
}

const audit = ref<NameAudit | null>(null)

function onAudit(report: NameAudit): void {
  audit.value = report
}

async function onApplyFix(): Promise<void> {
  const next = await window.api.applyNameFix()
  await refreshState()
  audit.value = await window.api.auditNames()
  if (next) pushToast('名单已整理完成')
}

async function onWizardDone(patchUi: {
  theme: 'light' | 'dark' | 'contrast'
  density: string
  fontSize: number
}): Promise<void> {
  await patch({
    onboarded: true,
    ui: {
      ...ui.value,
      theme: patchUi.theme,
      density: patchUi.density as never,
      fontSize: patchUi.fontSize,
      background: THEME_PALETTE[patchUi.theme].background,
      buttonbg: THEME_PALETTE[patchUi.theme].buttonbg,
      nameColor: THEME_PALETTE[patchUi.theme].nameColor
    }
  })
  await refreshState()
}

async function onReset(): Promise<void> {
  await patch({
    ui: {
      ...ui.value,
      fontFamily: 'Microsoft YaHei',
      fontSize: 220,
      autoFit: true,
      background: THEME_PALETTE.light.background,
      buttonbg: THEME_PALETTE.light.buttonbg,
      nameColor: THEME_PALETTE.light.nameColor,
      alpha: 0.96,
      theme: 'light',
      uiScale: 1,
      density: 'auto',
      slim: false
    }
  })
}
</script>

<template>
  <div class="shell" :class="{ slim: ui.slim }" :style="shellStyle">
    <div v-if="ui.slim" class="reveal-zone top" />
    <div v-if="ui.slim" class="reveal-zone bottom" />

    <header class="titlebar">
      <div class="brand">
        <span class="brand-dot" />
        <span>{{ t('brand') }}</span>
        <span class="chip" style="height: 1.8rem; font-size: 0.72rem">
          v{{ state?.version ? state.version.join('.') : '0.2.0.0' }}
        </span>
      </div>

      <div class="class-select" @click.stop>
        <button class="class-trigger" @click="classMenu = !classMenu">
          <Icon name="users" :size="16" />
          {{ cls?.name || t('noClass') }}
          <span class="tag">{{ cls?.names.length ?? 0 }} {{ t('people') }}</span>
        </button>
        <div v-if="classMenu" class="class-menu">
          <button
            v-for="c in state?.classes"
            :key="c.id"
            :class="{ on: c.id === state?.activeClassId }"
            @click="setClass(c.id); classMenu = false"
          >
            <span>{{ c.name }}</span>
            <span class="tag">{{ c.names.length }} {{ t('people') }}</span>
          </button>
        </div>
      </div>

      <span class="spacer" />

      <span class="chip">
        {{ t('remaining') }} <strong>{{ remaining }}</strong> / {{ total }}
      </span>
      <span class="chip" v-if="lastResult">
        {{ t('last') }} <strong>{{ lastResult.name }}</strong>
      </span>

      <button
        class="icon-btn"
        :class="{ active: ui.topmost }"
        :title="t('pin')"
        @click="patch({ ui: { ...ui, topmost: !ui.topmost } })"
      >
        <Icon name="pin" />
      </button>
      <button
        class="icon-btn"
        :class="{ active: ui.fullscreen }"
        :title="t('fullscreen')"
        @click="toggleFullscreen()"
      >
        <Icon name="fullscreen" />
      </button>
      <button class="icon-btn" :title="`${t('settings')} (S)`" @click="openSettings()">
        <Icon name="gear" />
      </button>
      <button class="icon-btn" :title="`${t('help')} (H)`" @click="openHelp">
        <Icon name="help" />
      </button>
      <button class="icon-btn" :title="t('minimize')" @click="minimize()">
        <Icon name="minus" />
      </button>
      <button class="icon-btn" :title="t('close')" @click="quit()">
        <Icon name="close" />
      </button>
    </header>

    <main
      class="stage"
      @pointerdown="pressStart"
      @pointerup="pressEnd"
      @pointerleave="pressEnd"
      @contextmenu.prevent="openSettings()"
    >
      <div class="name-box" ref="boxRef">
        <div
          ref="nameRef"
          class="name"
          :class="{ rolling, pop: popKey > 0, empty: !total }"
          :style="{ fontFamily: ui.fontFamily, fontSize: fitSize + 'px' }"
          :key="popKey"
        >
          {{ total ? (lastResult || rolling ? displayName : t('brand')) : t('emptyRoster') }}
        </div>
      </div>

      <div class="weight-badge" v-if="showWeight">
        {{ lastResult?.name }} · ×{{ lastWeight }}
      </div>

      <div class="meta">
        <template v-if="total">
          <span>{{ t('poolLeft') }} <b>{{ remaining }}</b> {{ t('people') }}</span>
          <span class="dot" />
          <span>{{ t('drawnThisRound') }} <b>{{ cls?.havenames.length ?? 0 }}</b> </span>
          <span class="dot" />
          <span>{{ ui.slim ? t('hintShort') : t('hintSpace') }}</span>
        </template>
        <template v-else>
          <span>{{ t('importHint') }}</span>
        </template>
      </div>
    </main>

    <footer class="touchbar">
      <button class="btn primary" :class="{ rolling }" :disabled="!total" @click="toggleRoll">
        <Icon :name="rolling ? 'pause' : 'play'" />
        {{ rolling ? t('pauseStop') : t('startRoll') }}
      </button>
      <button class="btn" :disabled="!total || rolling" @click="draw">
        <Icon name="dice" />
        {{ t('draw') }}
      </button>

      <div class="touch-group">
        <button class="btn small" :disabled="rolling" :title="`${t('undo')} (Ctrl+Z)`" @click="undo">
          <Icon name="undo" :size="18" />
          {{ t('undo') }}
        </button>
        <button class="btn small" :disabled="rolling" :title="t('reset')" @click="resetPool">
          <Icon name="reset" :size="18" />
          {{ t('reset') }}
        </button>
        <button class="btn small" :disabled="!lastResult || rolling" :title="t('add1')" @click="bumpWeight">
          <Icon name="plus" :size="18" />
          {{ t('add1') }}
        </button>
      </div>

      <span class="spacer" />

      <div class="touch-group">
        <button
          class="btn small ghost"
          :disabled="!ui.autoFit && ui.fontSize <= 40"
          :title="t('font')"
          @click="patch({ ui: { ...ui, fontSize: Math.max(40, ui.fontSize - 20) } })"
        >
          <Icon name="minus" :size="18" />
        </button>
        <span class="chip" style="min-width: 5.5rem; justify-content: center">
          {{ Math.round(ui.fontSize) }} {{ t('fontSize') }}
        </span>
        <button
          class="btn small ghost"
          :title="t('font')"
          @click="patch({ ui: { ...ui, fontSize: Math.min(480, ui.fontSize + 20) } })"
        >
          <Icon name="plus" :size="18" />
        </button>
        <button
          class="icon-btn"
          :class="{ active: bgmOn }"
          :title="t('bgm')"
          @click="toggleBgm"
        >
          <Icon name="music" />
        </button>
        <button class="btn small" @click="openSettings('data')">
          <Icon name="record" :size="18" />
          {{ t('records') }} {{ state?.records.length ?? 0 }}
        </button>
      </div>
    </footer>

    <SettingsDrawer
      v-if="drawerOpen"
      :initial="state!"
      :focus-section="drawerFocus"
      @close="drawerOpen = false; drawerFocus = undefined"
      @save="onSave"
      @reset="onReset"
      @encoding-help="openEncodingHelp"
      @pick-bgm="pickBgm"
      @audit="onAudit"
    />

    <InfoModal v-if="info" :title="info.title" :body="info.body" @close="info = null" />

    <AuditModal v-if="audit" :report="audit" @close="audit = null" @fix="onApplyFix" />

    <Wizard v-if="state && state.onboarded === false" :initial="state" @done="onWizardDone" />

    <div v-if="updateInfo" class="update-card">
      <h4>{{ t('foundNew') }} v{{ updateInfo.latest }}</h4>
      <p>{{ updateInfo.notes || t('foundNew') }}</p>
      <div v-if="updateProgress" class="update-progress">
        <div class="update-progress-bar" :style="{ width: updatePct + '%' }" />
        <span class="update-progress-text">{{ updatePct }}{{ t('downloadingBg') }}</span>
      </div>
      <div class="row">
        <button
          class="btn small primary"
          style="height: 2.6rem; font-size: 0.85rem"
          :disabled="!!updateProgress"
          @click="onDownloadUpdate()"
        >
          {{ updateProgress ? t('downloading') : t('oneClick') }}
        </button>
        <button
          class="btn small"
          style="height: 2.6rem; font-size: 0.85rem"
          @click="onOpenRelease()"
        >
          {{ t('openPage') }}
        </button>
        <button class="btn small ghost" style="height: 2.6rem; font-size: 0.85rem" @click="updateInfo = null">
          {{ t('later') }}
        </button>
      </div>
    </div>

    <div class="toasts">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.kind">{{ t.text }}</div>
    </div>
  </div>
</template>
