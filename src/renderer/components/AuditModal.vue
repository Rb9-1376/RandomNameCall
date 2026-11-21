<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import type { NameAudit } from '@shared/types'

const props = defineProps<{ report: NameAudit }>()
const emit = defineEmits<{ close: []; fix: [] }>()

const clean = computed(
  () =>
    !props.report.duplicates.length &&
    !props.report.empties &&
    !props.report.tooLong.length &&
    !props.report.suspicious.length
)

const rows = computed(() => {
  const r = props.report
  const out: string[] = []
  if (r.empties) out.push(`空行 / 空白项：${r.empties} 条`)
  if (r.duplicates.length)
    out.push(
      `重复姓名：${r.duplicates.length} 组 → ${r.duplicates
        .slice(0, 8)
        .map((d) => `${d.name}×${d.count}`)
        .join('、')}${r.duplicates.length > 8 ? ' …' : ''}`
    )
  if (r.tooLong.length)
    out.push(
      `偏长姓名（超过 12 字，舞台会缩字）：${r.tooLong.length} 条 → ${r.tooLong
        .slice(0, 6)
        .map((t) => t.name)
        .join('、')}`
    )
  if (r.suspicious.length)
    out.push(
      `疑似异常：${r.suspicious.length} 条 → ${r.suspicious
        .slice(0, 8)
        .map((s) => `${s.name}(${s.reason})`)
        .join('、')}`
    )
  return out
})
</script>

<template>
  <div class="modal">
    <div class="overlay" @click="emit('close')" />
    <div class="modal-card" style="z-index: 41">
      <div class="modal-head">
        <Icon name="users" />
        <h2>名单体检</h2>
        <span class="spacer" />
        <button class="icon-btn" title="关闭" @click="emit('close')">
          <Icon name="close" />
        </button>
      </div>
      <div class="modal-body">
        <p style="margin: 0 0 0.8rem">
          共 <b>{{ report.total }}</b> 条，去重后 <b>{{ report.unique }}</b> 人。
          <template v-if="clean">没有发现明显问题。</template>
        </p>
        <ul v-if="rows.length" style="margin: 0; padding-left: 1.1rem; line-height: 1.9">
          <li v-for="r in rows" :key="r">{{ r }}</li>
        </ul>
        <p v-if="report.fixable > 0" style="margin: 0.9rem 0 0; color: var(--muted)">
          一键修复会删掉 {{ report.fixable }} 条：去空行、删掉纯数字/单字母这类明显不是姓名的条目、合并重复、去掉换行与首尾空格、超长截断到 32 字。修复后
          <b>{{ report.fixedNames.length }}</b> 人。本场进度会保留仍存在的姓名。
        </p>
        <p v-else-if="!clean" style="margin: 0.9rem 0 0; color: var(--muted)">
          这些问题不需要改名单（比如偏长的姓名也能正常缩字显示），可以继续用。
        </p>
      </div>
      <div class="modal-foot">
        <button class="btn" @click="emit('close')">关闭</button>
        <button
          class="btn primary"
          style="height: 3rem; font-size: 1rem; padding: 0 1.4rem"
          :disabled="report.fixable === 0"
          @click="emit('fix')"
        >
          一键修复
        </button>
      </div>
    </div>
  </div>
</template>
