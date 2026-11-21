<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { THEME_PALETTE } from '@shared/theme'
import type { AppState, EncodingName, NameAudit } from '@shared/types'
import { preview, pushToast, refreshState, runtime } from '../composables/useApp'
import { LANGUAGES, t } from '../i18n'

const props = defineProps<{ initial: AppState; focusSection?: string }>()
const emit = defineEmits<{
  close: []
  save: [next: AppState]
  reset: []
  'encoding-help': []
  'pick-bgm': []
  audit: [report: NameAudit]
}>()

const dataSection = ref<HTMLElement | null>(null)

onMounted(() => {
  // 从主界面"记录"按钮进来时，直接定位到"数据"段
  if (props.focusSection === 'data') {
    requestAnimationFrame(() => dataSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
})

const draft = reactive<AppState>(JSON.parse(JSON.stringify(props.initial)) as AppState)
const fonts = ref<string[]>([])
const mirrors = ref<{ id: string; label: string; ms: number | null }[]>([])
const probing = ref(false)
const sourcesText = ref(draft.net.rosterSources.join('\n'))

const activeClass = computed(
  () => draft.classes.find((c) => c.id === draft.activeClassId) ?? draft.classes[0]
)

const history = computed<string[]>(() => props.initial.historyFiles ?? [])

// 切主题时套用该主题的默认三色，避免"深色主题 + 白底深字"这种混搭
watch(
  () => draft.ui.theme,
  (next, prev) => {
    if (next === prev) return
    const p = THEME_PALETTE[next]
    draft.ui.background = p.background
    draft.ui.buttonbg = p.buttonbg
    draft.ui.nameColor = p.nameColor
  }
)

const remaining = computed(() =>
  draft.roll.noRepeat
    ? activeClass.value.names.length - activeClass.value.havenames.length
    : activeClass.value.names.length
)

function shortPath(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts.length <= 2 ? p : `…/${parts.slice(-2).join('/')}`
}

async function syncDraft(): Promise<void> {
  const s = await window.api.getState()
  Object.assign(draft, JSON.parse(JSON.stringify(s)) as AppState)
}

const ENCODINGS: EncodingName[] = [
  '自动',
  'UTF-8',
  'UTF-8-SIG',
  'UTF-16',
  'UTF-16 LE',
  'UTF-16 BE',
  'GB18030',
  'GB2312',
  'BIG5'
]

watch(
  draft,
  () => {
    preview.value = JSON.parse(JSON.stringify(draft)) as AppState
  },
  { deep: true }
)

onMounted(async () => {
  preview.value = JSON.parse(JSON.stringify(draft)) as AppState
  fonts.value = await window.api.listFonts()
})

onBeforeUnmount(() => {
  preview.value = null
})

function cancel(): void {
  preview.value = null
  emit('close')
}

function save(): void {
  draft.net.rosterSources = sourcesText.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  emit('save', JSON.parse(JSON.stringify(draft)) as AppState)
}

async function chooseFile(): Promise<void> {
  const read = await window.api.pickNamesFile()
  if (!read) return
  await refreshState()
  const s = await window.api.getState()
  Object.assign(draft, JSON.parse(JSON.stringify(s)) as AppState)
  pushToast(t('loadedNames', { n: read.names.length }))
}

async function reloadFile(): Promise<void> {
  const r = await window.api.reloadActiveClass()
  if (!r) return
  await refreshState()
  const s = await window.api.getState()
  Object.assign(draft, JSON.parse(JSON.stringify(s)) as AppState)
  pushToast(t('rosterReloaded', { n: r.names.length }))
}

async function importBuiltin(): Promise<void> {
  const next = await window.api.importBuiltin()
  Object.assign(draft, JSON.parse(JSON.stringify(next)) as AppState)
  await refreshState()
  pushToast(t('builtinRestored'))
}

async function openHistory(file: string): Promise<void> {
  if (!file) return
  const r = await window.api.openNames(file)
  await syncDraft()
  await refreshState()
  if (r.names.length) pushToast(t('loadedNames', { n: r.names.length }))
}

async function clearHistory(): Promise<void> {
  await window.api.clearHistory()
  await syncDraft()
  await refreshState()
  pushToast(t('historyCleared'))
}

async function resetPool(): Promise<void> {
  await window.api.resetPool()
  await syncDraft()
  await refreshState()
  pushToast(t('resetDone'))
}

async function clearCumulative(): Promise<void> {
  await window.api.clearCumulative()
  await syncDraft()
  await refreshState()
  pushToast(t('cumulativeCleared'))
}

async function runAudit(): Promise<void> {
  const report = await window.api.auditNames()
  emit('audit', report)
}

async function openDataDir(): Promise<void> {
  await window.api.openDataDir()
}

async function checkNow(): Promise<void> {
  const info = await window.api.checkUpdate(true)
  if (!info) return
  pushToast(`${t('foundNew')} v${info.latest}`, 'ok')
  const url = info.downloads[0]?.url
  if (url) void window.api.openExternal(url)
}

async function probe(): Promise<void> {
  probing.value = true
  try {
    mirrors.value = await window.api.testMirrors()
  } finally {
    probing.value = false
  }
}

async function refreshRoster(): Promise<void> {
  draft.net.rosterSources = sourcesText.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  await window.api.patchState({ net: JSON.parse(JSON.stringify(draft.net)) })
  const r = await window.api.refreshRoster()
  pushToast(r.message, r.ok ? 'ok' : 'warn')
  const s = await window.api.getState()
  Object.assign(draft, JSON.parse(JSON.stringify(s)) as AppState)
}

async function exportRecords(): Promise<void> {
  const file = await window.api.exportRecords()
  if (file) pushToast(t('exported'))
}

async function chooseBgm(): Promise<void> {
  emit('pick-bgm')
}
</script>

<template>
  <div class="overlay" @click.self="cancel" />
  <aside class="drawer">
    <div class="drawer-head">
      <Icon name="gear" />
      <h2>{{ t('settingsTitle') }}</h2>
      <span class="spacer" />
      <button class="icon-btn" :title="t('closeDrawer')" @click="cancel">
        <Icon name="close" />
      </button>
    </div>

    <div class="drawer-body">
      <section class="section">
        <h3>{{ t('secRoster') }}</h3>
        <div class="field">
          <label>{{ t('className') }}</label>
          <input v-model="activeClass.name" class="input" />
        </div>
        <div class="field">
          <label>
            {{ t('nameFile') }}
            <span class="hint">{{ activeClass.source.path || t('builtinHint') }}</span>
          </label>
          <div style="display: flex; gap: 0.4rem">
            <button class="btn small" @click="chooseFile">{{ t('chooseBtn') }}</button>
            <button class="btn small" @click="reloadFile">{{ t('reload') }}</button>
          </div>
        </div>
        <div v-if="history.length" class="field">
          <label>
            {{ t('recentUsed') }}
            <span class="hint">{{ t('recentHint') }}</span>
          </label>
          <div style="display: flex; gap: 0.4rem; align-items: center">
            <select class="select" style="max-width: 13rem" @change="openHistory(($event.target as HTMLSelectElement).value)">
              <option value="">{{ t('pickPh') }}</option>
              <option v-for="f in history" :key="f" :value="f">{{ shortPath(f) }}</option>
            </select>
            <button class="btn small ghost" @click="clearHistory">{{ t('clear') }}</button>
          </div>
        </div>
        <div class="field">
          <label>
            {{ t('encoding') }}
            <span class="hint">{{ t('encHint') }}</span>
          </label>
          <div style="display: flex; gap: 0.4rem; align-items: center">
            <select v-model="activeClass.encoding" class="select" style="max-width: 9rem">
              <option v-for="e in ENCODINGS" :key="e" :value="e">{{ e }}</option>
            </select>
            <button class="btn small ghost" @click="emit('encoding-help')">{{ t('explain') }}</button>
          </div>
        </div>
        <div class="field" style="align-items: flex-start">
          <label>
            {{ t('namePreview') }}
            <span class="hint">{{ t('previewCount', { a: activeClass.names.length, b: activeClass.havenames.length }) }}</span>
          </label>
        </div>
        <div class="chips">
          <span v-for="n in activeClass.names.slice(0, 14)" :key="n" class="name-chip">{{ n }}</span>
          <span v-if="activeClass.names.length > 14" class="name-chip muted">
            {{ t('moreNames', { n: activeClass.names.length - 14 }) }}
          </span>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.6rem">
          <button class="btn small" @click="importBuiltin">{{ t('restoreBuiltin') }}</button>
          <button class="btn small" @click="runAudit">{{ t('audit') }}</button>
        </div>
      </section>

      <section class="section">
        <h3>{{ t('secAppearance') }}</h3>
        <div class="field">
          <label>{{ t('lang') }}</label>
          <select v-model="draft.ui.lang" class="select">
            <option v-for="l in LANGUAGES" :key="l.code" :value="l.code">{{ l.label }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{ t('theme') }}</label>
          <select v-model="draft.ui.theme" class="select">
            <option value="light">{{ t('themeLight') }}</option>
            <option value="dark">{{ t('themeDark') }}</option>
            <option value="contrast">{{ t('themeContrast') }}</option>
          </select>
        </div>
        <div class="field">
          <label>
            {{ t('uiScale') }}
            <span class="hint">{{ t('uiScaleHint') }}</span>
          </label>
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <input v-model.number="draft.ui.uiScale" type="range" min="0.8" max="1.6" step="0.05" />
            <span class="chip">{{ draft.ui.uiScale.toFixed(2) }}×</span>
          </div>
        </div>
        <div class="field">
          <label>{{ t('density') }}</label>
          <select v-model="draft.ui.density" class="select">
            <option value="auto">{{ t('densityAuto') }}</option>
            <option value="compact">{{ t('densityCompact') }}</option>
            <option value="normal">{{ t('densityNormal') }}</option>
            <option value="comfort">{{ t('densityComfort') }}</option>
            <option value="large">{{ t('densityLarge') }}</option>
          </select>
        </div>
        <div class="field">
          <label>
            {{ t('perfMode') }}
            <span class="hint">{{ t('perfHint') }}</span>
          </label>
          <button
            class="switch"
            :class="{ on: draft.ui.perfMode }"
            @click="draft.ui.perfMode = !draft.ui.perfMode"
          />
        </div>
        <div class="field">
          <label>
            {{ t('slimMode') }}
            <span class="hint">{{ t('slimHint') }}</span>
          </label>
          <button
            class="switch"
            :class="{ on: draft.ui.slim }"
            @click="draft.ui.slim = !draft.ui.slim"
          />
        </div>
        <div class="field">
          <label>{{ t('font') }}</label>
          <select v-model="draft.ui.fontFamily" class="select">
            <option v-for="f in fonts" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{ t('fontMax') }}</label>
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <input v-model.number="draft.ui.fontSize" type="range" min="40" max="480" step="4" />
            <span class="chip">{{ draft.ui.fontSize }} px</span>
          </div>
        </div>
        <div class="field">
          <label>
            {{ t('autoFit') }}
            <span class="hint">{{ t('autoFitHint') }}</span>
          </label>
          <button
            class="switch"
            :class="{ on: draft.ui.autoFit }"
            @click="draft.ui.autoFit = !draft.ui.autoFit"
          />
        </div>
        <div class="field">
          <label>{{ t('background') }}</label>
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <input v-model="draft.ui.background" type="color" />
            <input v-model="draft.ui.background" class="input" style="width: 7rem" />
          </div>
        </div>
        <div class="field">
          <label>{{ t('buttonbg') }}</label>
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <input v-model="draft.ui.buttonbg" type="color" />
            <input v-model="draft.ui.buttonbg" class="input" style="width: 7rem" />
          </div>
        </div>
        <div class="field">
          <label>{{ t('nameColor') }}</label>
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <input v-model="draft.ui.nameColor" type="color" />
            <input v-model="draft.ui.nameColor" class="input" style="width: 7rem" />
          </div>
        </div>
        <div class="field">
          <label>
            {{ t('alpha') }}
            <span class="hint">{{ t('alphaHint') }}</span>
          </label>
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <input v-model.number="draft.ui.alpha" type="range" min="0.35" max="1" step="0.01" />
            <span class="chip">{{ Math.round(draft.ui.alpha * 100) }}%</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h3>{{ t('secBehavior') }}</h3>
        <div class="field">
          <label>{{ t('rollSpeed') }}</label>
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <input v-model.number="draft.roll.speed" type="range" min="30" max="400" step="10" />
            <span class="chip">{{ draft.roll.speed }} ms</span>
          </div>
        </div>
        <div class="field">
          <label>{{ t('extractAnim') }}</label>
          <button
            class="switch"
            :class="{ on: draft.roll.extractAnimation }"
            @click="draft.roll.extractAnimation = !draft.roll.extractAnimation"
          />
        </div>
        <div class="field">
          <label>
            {{ t('noRepeat') }}
            <span class="hint">{{ t('roundDone') }}</span>
          </label>
          <button
            class="switch"
            :class="{ on: draft.roll.noRepeat }"
            @click="draft.roll.noRepeat = !draft.roll.noRepeat"
          />
        </div>
        <div class="field">
          <label>{{ t('add1Tip') }}</label>
          <button
            class="switch"
            :class="{ on: draft.roll.add1Tip }"
            @click="draft.roll.add1Tip = !draft.roll.add1Tip"
          />
        </div>
        <div class="field">
          <label>{{ t('autoCenter') }}</label>
          <button
            class="switch"
            :class="{ on: draft.ui.autoCenter }"
            @click="draft.ui.autoCenter = !draft.ui.autoCenter"
          />
        </div>
        <div class="field">
          <label>{{ t('slimMode') }}</label>
          <button class="switch" :class="{ on: draft.ui.slim }" @click="draft.ui.slim = !draft.ui.slim" />
        </div>
        <div class="field">
          <label>{{ t('pin') }}</label>
          <button
            class="switch"
            :class="{ on: draft.ui.topmost }"
            @click="draft.ui.topmost = !draft.ui.topmost"
          />
        </div>
        <div class="field">
          <label>{{ t('fullscreenRun') }}</label>
          <button
            class="switch"
            :class="{ on: draft.ui.fullscreen }"
            @click="draft.ui.fullscreen = !draft.ui.fullscreen"
          />
        </div>
        <div class="field">
          <label>{{ t('ballToggle') }}</label>
          <button class="switch" :class="{ on: draft.ball.enabled }" @click="draft.ball.enabled = !draft.ball.enabled" />
        </div>
        <div class="field">
          <label>
            {{ t('sessionProgress') }}
            <span class="hint">{{ t('sessionHint', { a: remaining, b: activeClass.names.length, c: activeClass.havenames.length }) }}</span>
          </label>
          <div style="display: flex; gap: 0.4rem">
            <button class="btn small" :disabled="!activeClass.havenames.length" @click="resetPool">{{ t('reset') }}</button>
            <button class="btn small ghost" @click="clearCumulative">{{ t('clearCumulative') }}</button>
          </div>
        </div>
      </section>

      <section class="section">
        <h3>{{ t('secSound') }}</h3>
        <div class="field">
          <label>{{ t('clickVolLabel') }}</label>
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <input v-model.number="draft.sound.click" type="range" min="0" max="1" step="0.05" />
            <span class="chip">{{ Math.round(draft.sound.click * 100) }}%</span>
          </div>
        </div>
        <div class="field">
          <label>
            {{ t('bgmLabel') }}
            <span class="hint">{{ t('bgmHint') }}</span>
          </label>
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <input v-model.number="draft.sound.bgm" type="range" min="0" max="1" step="0.05" />
            <button class="btn small" @click="chooseBgm">{{ t('chooseBtn') }}</button>
            <button class="btn small ghost" @click="draft.sound.bgmFile = null">{{ t('clearBtn') }}</button>
          </div>
        </div>
        <div class="field">
          <label>{{ t('ttsLabel') }}</label>
          <button class="switch" :class="{ on: draft.sound.tts }" @click="draft.sound.tts = !draft.sound.tts" />
        </div>
        <div class="field">
          <label>{{ t('ttsRate') }}</label>
          <div style="display: flex; align-items: center; gap: 0.5rem">
            <input v-model.number="draft.sound.rate" type="range" min="0.6" max="1.6" step="0.1" />
            <span class="chip">{{ draft.sound.rate.toFixed(1) }}×</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h3>{{ t('secNet') }}</h3>
        <div class="field">
          <label>
            {{ t('onlineEnabled') }}
            <span class="hint">{{ t('onlineHint') }}</span>
          </label>
          <button
            class="switch"
            :class="{ on: draft.net.onlineEnabled }"
            @click="draft.net.onlineEnabled = !draft.net.onlineEnabled"
          />
        </div>
        <textarea
          v-model="sourcesText"
          class="input"
          style="width: 100%; height: 5rem; padding: 0.6rem; resize: vertical"
          placeholder="每行一个地址，例如 https://example.com/roster.json"
        />
        <div style="display: flex; gap: 0.5rem; margin-top: 0.6rem">
          <button class="btn small" @click="refreshRoster">{{ t('refreshNow') }}</button>
          <button class="btn small" @click="probe" :disabled="probing">
            {{ probing ? t('probeTesting') : t('probeNow') }}
          </button>
        </div>
        <div v-if="mirrors.length" class="mirror-list">
          <span v-for="m in mirrors" :key="m.id" class="name-chip" :class="{ ok: m.ms !== null }">
            {{ m.label }} {{ m.ms !== null ? m.ms + 'ms' : t('probeDown') }}
          </span>
        </div>
        <div class="field">
          <label>
            {{ t('proxyLabel') }}
            <span class="hint">{{ t('proxyHint') }}</span>
          </label>
          <input v-model="draft.net.proxyRules" class="input" placeholder="http://127.0.0.1:7890" />
        </div>
        <div class="field">
          <label>{{ t('checkOnStart') }}</label>
          <button
            class="switch"
            :class="{ on: draft.update.checkOnStart }"
            @click="draft.update.checkOnStart = !draft.update.checkOnStart"
          />
        </div>
      </section>

      <section class="section" ref="dataSection">
        <h3>{{ t('secData') }}</h3>
        <div class="field">
          <label>
            {{ t('dataDir') }}
            <span class="hint">{{ runtime?.dataDir }}</span>
          </label>
          <button class="btn small" @click="openDataDir">{{ t('open') }}</button>
        </div>
        <div class="field">
          <label>{{ t('drawRecords') }}</label>
          <div style="display: flex; gap: 0.4rem">
            <span class="chip">{{ draft.records.length }} {{ t('recordsUnit') }}</span>
            <button class="btn small" @click="exportRecords">{{ t('exportCsv') }}</button>
          </div>
        </div>
        <div class="field">
          <label>{{ t('resetAppearance') }}</label>
          <button class="btn small danger" @click="emit('reset')">{{ t('restoreDefault') }}</button>
        </div>
      </section>

      <section class="section">
        <h3>{{ t('secAbout') }}</h3>
        <div class="field">
          <label>{{ t('versionLabel') }}</label>
          <span class="chip">v{{ draft.version.join('.') }}</span>
        </div>
        <div class="field">
          <label>{{ t('authorLabel') }}</label>
          <span class="chip">Rb9-1376</span>
        </div>
        <div class="field">
          <label>QQ</label>
          <span class="chip">1709854716</span>
        </div>
        <div class="field">
          <label>{{ t('emailLabel') }}</label>
          <span class="chip">1709854716@qq.com</span>
        </div>
        <div class="field">
          <label>{{ t('checkUpdateLabel') }}</label>
          <button class="btn small" @click="checkNow">{{ t('checkNow') }}</button>
        </div>
      </section>
    </div>

    <div class="drawer-foot">
      <button class="btn small ghost" @click="emit('reset')">{{ t('restoreDefault') }}</button>
      <span class="spacer" />
      <button class="btn small" @click="cancel">{{ t('cancel') }}</button>
      <button class="btn small primary" style="height: 2.9rem; font-size: 0.9rem" @click="save">
        {{ t('save') }}
      </button>
    </div>
  </aside>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.name-chip {
  padding: 0.2rem 0.55rem;
  border-radius: 0.5rem;
  border: 1px solid var(--line);
  background: var(--panel-2);
  font-size: 0.78rem;
  color: var(--muted);
}

.name-chip.muted {
  opacity: 0.6;
}

.name-chip.ok {
  color: var(--ok);
  border-color: rgba(61, 220, 151, 0.4);
}

.mirror-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.6rem;
}
</style>
