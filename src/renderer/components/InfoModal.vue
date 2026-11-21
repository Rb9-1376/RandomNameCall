<script setup lang="ts">
import Icon from './Icon.vue'

const props = defineProps<{ title: string; body: string }>()
const emit = defineEmits<{ close: [] }>()

async function save(): Promise<void> {
  const name = `${props.title.replace(/[\\/:*?"<>|]/g, '')}.txt`
  const ok = await window.api.saveText(name, props.body)
  if (ok) emit('close')
}
</script>

<template>
  <div class="modal" @click.self="emit('close')">
    <div class="modal-card">
      <div class="modal-head">
        <Icon name="help" />
        <h2>{{ title }}</h2>
        <span class="spacer" />
        <button class="icon-btn" title="关闭 (Esc)" @click="emit('close')">
          <Icon name="close" />
        </button>
      </div>
      <div class="modal-body">{{ body }}</div>
      <div class="modal-foot">
        <button class="btn small" @click="save">
          <Icon name="download" :size="18" />
          保存为 txt
        </button>
        <button class="btn small primary" style="height: 2.9rem; font-size: 0.9rem" @click="emit('close')">
          知道了
        </button>
      </div>
    </div>
  </div>
</template>
