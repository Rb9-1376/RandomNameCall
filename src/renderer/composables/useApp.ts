import { computed, ref } from 'vue'
import type { AppState, DrawResult, RuntimeInfo, UpdateInfo } from '@shared/types'
import clickUrl from '../assets/click.wav'
import { t } from '../i18n'

export const state = ref<AppState | null>(null)
export const runtime = ref<RuntimeInfo | null>(null)
export const preview = ref<AppState | null>(null)
export const ready = ref(false)

export const displayName = ref('随机点名')
export const rolling = ref(false)
export const popKey = ref(0)
export const lastResult = ref<DrawResult | null>(null)
export const lastWeight = ref(1)
export const drawCount = ref(0)

export const updateInfo = ref<UpdateInfo | null>(null)
export const updateProgress = ref<{ received: number; total: number } | null>(null)
export const updateDownloaded = ref<string | null>(null)

export interface ToastItem {
  id: number
  text: string
  kind: 'ok' | 'warn' | 'err'
}
export const toasts = ref<ToastItem[]>([])
let toastId = 0

export function pushToast(text: string, kind: 'ok' | 'warn' | 'err' = 'ok'): void {
  const id = ++toastId
  toasts.value = [...toasts.value.slice(-3), { id, text, kind }]
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 3200)
}

export const effective = computed<AppState | null>(() => preview.value ?? state.value)
export const activeClass = computed(() => {
  const s = effective.value
  if (!s) return null
  return s.classes.find((c) => c.id === s.activeClassId) ?? s.classes[0] ?? null
})

export const total = computed(() => activeClass.value?.names.length ?? 0)
export const remaining = computed(() =>
  activeClass.value ? activeClass.value.names.length - activeClass.value.havenames.length : 0
)

const audio = new Audio(clickUrl)
audio.volume = 0.7
let bgm: HTMLAudioElement | null = null

export function playClick(volume: number): void {
  if (volume <= 0) return
  try {
    const node = audio.cloneNode(true) as HTMLAudioElement
    node.volume = Math.min(1, volume)
    void node.play()
  } catch {
    /* 播不出来不影响点名 */
  }
}

export function syncAudio(): void {
  const s = state.value
  audio.volume = s?.sound.click ?? 0.7
}

export function startBgm(): void {
  const s = state.value
  if (!s?.sound.bgmFile || s.sound.bgm <= 0) return
  stopBgm()
  bgm = new Audio('rnc://bgm')
  bgm.loop = true
  bgm.volume = s.sound.bgm
  void bgm.play().catch(() => pushToast('BGM 文件无法播放', 'warn'))
}

export function stopBgm(): void {
  if (bgm) {
    bgm.pause()
    bgm = null
  }
}

export function setBgmVolume(v: number): void {
  if (bgm) bgm.volume = v
}

export function speak(name: string): void {
  const s = state.value
  if (!s?.sound.tts) return
  try {
    const u = new SpeechSynthesisUtterance(name)
    u.lang = 'zh-CN'
    u.rate = s.sound.rate
    if (s.sound.voice) {
      const v = speechSynthesis.getVoices().find((vv) => vv.name === s.sound.voice)
      if (v) u.voice = v
    }
    speechSynthesis.speak(u)
  } catch {
    /* 忽略 */
  }
}

export async function refreshState(): Promise<void> {
  state.value = await window.api.getState()
  syncAudio()
}

export async function init(): Promise<void> {
  state.value = await window.api.getState()
  runtime.value = await window.api.getRuntime()
  syncAudio()
  ready.value = true

  window.api.onState((s) => {
    if (!s) return
    state.value = s
    syncAudio()
  })
  window.api.onTick((name) => {
    displayName.value = name
    rolling.value = true
  })
  window.api.onResult((r) => {
    rolling.value = false
    displayName.value = r.name
    lastResult.value = r
    lastWeight.value = 1
    drawCount.value += 1
    popKey.value += 1
    playClick(state.value?.sound.click ?? 0.7)
    speak(r.name)
    void refreshState()
  })
  window.api.onToast(({ text, kind }) => pushToast(text, kind ?? 'ok'))
  window.extra.onUpdate((info) => {
    updateInfo.value = info
  })
  window.extra.onUpdateProgress((p) => {
    updateProgress.value = p
  })
  window.extra.onUpdateDownloaded(({ path }) => {
    updateProgress.value = null
    updateDownloaded.value = path
  })
  window.extra.onUpdateDownloadFailed(() => {
    updateProgress.value = null
    pushToast('更新下载失败，可改用「前往下载页」手动安装', 'err')
  })
  window.extra.onMetrics((m) => {
    if (runtime.value) {
      runtime.value = { ...runtime.value, screen: { width: m.width, height: m.height }, scaleFactor: m.scaleFactor }
    }
  })
}

export async function patch(p: Partial<AppState>): Promise<void> {
  state.value = await window.api.patchState(p)
  syncAudio()
}

export async function draw(): Promise<void> {
  const r = await window.api.draw()
  if (!r) return
}

export async function toggleRoll(): Promise<void> {
  if (rolling.value) {
    await window.api.stopRoll()
  } else {
    const ok = await window.api.startRoll()
    if (ok) rolling.value = true
  }
}

export async function undo(): Promise<void> {
  const r = await window.api.undo()
  if (!r) {
    pushToast(t('noUndo'), 'warn')
    return
  }
  displayName.value = r.name
  lastResult.value = r
  await refreshState()
  pushToast(t('undoDone', { n: r.name }), 'ok')
}

export async function resetPool(): Promise<void> {
  await window.api.resetPool()
  await refreshState()
  pushToast(t('resetDone'), 'ok')
}

export async function bumpWeight(): Promise<void> {
  if (!lastResult.value) {
    pushToast(t('bumpFirst'), 'warn')
    return
  }
  const r = await window.api.bumpWeight(lastResult.value.name)
  lastWeight.value = r.weight
  pushToast(t('bumpWeight', { n: r.name, w: r.weight }), 'ok')
}

export async function setClass(id: string): Promise<void> {
  state.value = await window.api.setClass(id)
}
