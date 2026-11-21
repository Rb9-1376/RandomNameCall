<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import type { AppState, Density, ThemeName } from '@shared/types'
import { pushToast, refreshState } from '../composables/useApp'

const props = defineProps<{ initial: AppState }>()
const emit = defineEmits<{
  done: [ui: { theme: ThemeName; density: Density | 'auto'; fontSize: number }]
}>()

const step = ref(0)
const theme = ref<ThemeName>(props.initial.ui.theme)
const density = ref<Density | 'auto'>('auto')
const fontSize = ref(props.initial.ui.fontSize)
const picking = ref(false)

const total = computed(() => {
  const cls = props.initial.classes.find((c) => c.id === props.initial.activeClassId)
  return cls?.names.length ?? 0
})

const fileName = computed(() => {
  const cls = props.initial.classes.find((c) => c.id === props.initial.activeClassId)
  const p = cls?.source?.path
  return p ? p.split(/[\\/]/).pop() : ''
})

const THEMES: { id: ThemeName; label: string; hint: string }[] = [
  { id: 'light', label: '白色', hint: '教室光线足、投影偏亮时更清楚' },
  { id: 'dark', label: '深色', hint: '大屏/夜晚不刺眼，文字更突出' },
  { id: 'contrast', label: '高对比', hint: '黑底白字，后排也看得清' }
]

const DENSITIES: { id: Density | 'auto'; label: string; hint: string }[] = [
  { id: 'auto', label: '自动', hint: '按屏幕宽度判断' },
  { id: 'compact', label: '紧凑', hint: '1024 / 1366 笔记本' },
  { id: 'normal', label: '标准', hint: '1920 一体机 / 希沃' },
  { id: 'comfort', label: '宽松', hint: '2560 大屏' },
  { id: 'large', label: '特大', hint: '4K 电视 / 大屏' }
]

async function pick(): Promise<void> {
  if (picking.value) return
  picking.value = true
  try {
    const r = await window.api.pickNamesFile()
    if (r) {
      await refreshState()
      pushToast(`已载入 ${r.names.length} 个姓名（${r.encoding}）`)
    }
  } finally {
    picking.value = false
  }
}

async function useBuiltin(): Promise<void> {
  await window.api.importBuiltin()
  await refreshState()
  pushToast('已使用内置示例名单')
}

function finish(): void {
  emit('done', { theme: theme.value, density: density.value, fontSize: fontSize.value })
}
</script>

<template>
  <div class="modal wizard">
    <div class="wizard-card">
      <div class="wizard-head">
        <span class="brand-dot" />
        <div>
          <h2>随机点名</h2>
          <p class="hint">三步配好，之后随时能在设置里改</p>
        </div>
        <span class="spacer" />
        <span class="chip">{{ step + 1 }} / 3</span>
      </div>

      <div class="wizard-body">
        <template v-if="step === 0">
          <h3>欢迎使用</h3>
          <p class="wizard-text">
            这是给教室大屏用的随机点名程序：一键抽取、滚动定格、不重复点名、累计次数、点名记录导出。
            支持鼠标、触摸屏和投影遥控笔，全程可键盘操作。
          </p>
          <ul class="wizard-list">
            <li><b>空格</b> 开始/暂停滚动，<b>回车</b> 直接抽一个</li>
            <li><b>S</b> 设置、<b>H</b> 帮助、<b>Ctrl+Z</b> 撤回</li>
            <li>舞台上<b>长按 600ms</b>（或右键）也能打开设置</li>
          </ul>
        </template>

        <template v-else-if="step === 1">
          <h3>先准备名单</h3>
          <p class="wizard-text">
            支持 <b>.txt / .csv / .xlsx</b>：一行一个姓名，或用逗号、分号、Tab 分隔；Excel 取「姓名」列。
            编码不用管，程序会自动识别 GBK / UTF-8 / UTF-16。
          </p>
          <div class="wizard-name-box">
            <div class="wizard-count">{{ total }}<span>人</span></div>
            <div class="hint">
              {{ fileName ? `当前文件：${fileName}` : '当前使用内置示例名单' }}
            </div>
          </div>
          <div class="wizard-actions">
            <button class="btn primary" style="height: 3.4rem; font-size: 1rem" @click="pick">
              <Icon name="download" />
              选择名单文件
            </button>
            <button class="btn" style="height: 3.4rem" @click="useBuiltin">用内置名单</button>
          </div>
          <p class="hint">也可以先跳过，进主界面后在设置 →「名单」里再选。</p>
        </template>

        <template v-else>
          <h3>挑个外观</h3>
          <div class="opt-grid">
            <button
              v-for="t in THEMES"
              :key="t.id"
              class="opt"
              :class="{ on: theme === t.id }"
              @click="theme = t.id"
            >
              <b>{{ t.label }}</b>
              <span>{{ t.hint }}</span>
            </button>
          </div>

          <h3 style="margin-top: 1.2rem">界面大小</h3>
          <div class="opt-grid">
            <button
              v-for="d in DENSITIES"
              :key="d.id"
              class="opt"
              :class="{ on: density === d.id }"
              @click="density = d.id"
            >
              <b>{{ d.label }}</b>
              <span>{{ d.hint }}</span>
            </button>
          </div>

          <div class="field" style="margin-top: 1.1rem">
            <label>姓名字号上限</label>
            <div style="display: flex; align-items: center; gap: 0.6rem">
              <input v-model.number="fontSize" type="range" min="120" max="420" step="10" />
              <span class="chip">{{ fontSize }} px</span>
            </div>
          </div>
        </template>
      </div>

      <div class="wizard-foot">
        <button v-if="step > 0" class="btn ghost" @click="step -= 1">上一步</button>
        <span class="spacer" />
        <button v-if="step < 2" class="btn primary" style="height: 3.2rem" @click="step += 1">
          下一步
        </button>
        <button v-else class="btn primary" style="height: 3.2rem" @click="finish">
          开始使用
        </button>
      </div>
    </div>
  </div>
</template>
