<script setup>
import { ref } from 'vue'
import { CloudUpload, CloudDownload, GitMerge, Loader2 } from 'lucide-vue-next'
import { useTaskStore } from '../../stores/tasks.js'
import { pullAll, pushAllLocal } from '../../stores/plugins/syncSupabase.js'
import { useToast } from '../../composables/useToast.js'

const props = defineProps({ cloudEmpty: Boolean })
const emit = defineEmits(['done'])

const tasks = useTaskStore()
const toast = useToast()
const busy = ref(false)

const localCount = tasks.items.length

async function chooseUpload() {
  busy.value = true
  try {
    await pushAllLocal()
    toast.success('Локальные данные загружены в облако')
    emit('done')
  } catch (e) {
    toast.error('Не удалось загрузить: ' + e.message)
  } finally { busy.value = false }
}

async function chooseReplace() {
  busy.value = true
  try {
    await pullAll()
    toast.success('Данные загружены из облака')
    emit('done')
  } catch (e) {
    toast.error('Не удалось загрузить: ' + e.message)
  } finally { busy.value = false }
}

async function chooseMerge() {
  // simple merge: pull cloud first, then push (keeps cloud as base, adds local missing)
  busy.value = true
  try {
    // capture local before pull overwrites
    const localBackup = JSON.parse(JSON.stringify(tasks.items))
    await pullAll()
    const existingIds = new Set(tasks.items.map(t => t.id))
    for (const t of localBackup) {
      if (!existingIds.has(t.id)) tasks.items.push(t)
    }
    toast.success('Данные объединены')
    emit('done')
  } catch (e) {
    toast.error('Слияние не удалось: ' + e.message)
  } finally { busy.value = false }
}
</script>

<template>
  <div class="sync-backdrop">
    <div class="sync-dialog">
      <h2>Синхронизация</h2>

      <p v-if="cloudEmpty" class="sync-sub">
        В облаке пусто. Залить локальные данные ({{ localCount }} задач)?
      </p>
      <p v-else class="sync-sub">
        В облаке уже есть данные. Что сделать с локальными ({{ localCount }} задач)?
      </p>

      <div class="sync-options">
        <button
          v-if="cloudEmpty || localCount > 0"
          class="sync-option"
          :disabled="busy"
          @click="chooseUpload"
        >
          <CloudUpload :size="22" />
          <div>
            <div class="sync-option-title">Залить локальные в облако</div>
            <div class="sync-option-desc">Перезапишет облако твоими данными</div>
          </div>
        </button>

        <button
          v-if="!cloudEmpty"
          class="sync-option"
          :disabled="busy"
          @click="chooseMerge"
        >
          <GitMerge :size="22" />
          <div>
            <div class="sync-option-title">Объединить</div>
            <div class="sync-option-desc">Облако + локальные (по id, без дубликатов)</div>
          </div>
        </button>

        <button
          v-if="!cloudEmpty"
          class="sync-option"
          :disabled="busy"
          @click="chooseReplace"
        >
          <CloudDownload :size="22" />
          <div>
            <div class="sync-option-title">Заменить локальные облачными</div>
            <div class="sync-option-desc">Локальные данные будут перезаписаны</div>
          </div>
        </button>
      </div>

      <div v-if="busy" class="sync-busy">
        <Loader2 :size="16" class="spin" /> Применяем…
      </div>
    </div>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;

.sync-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: grid; place-items: center;
  z-index: $z-modal;
  padding: $space-4;
}
.sync-dialog {
  background: $color-bg-elevated;
  border-radius: $radius-lg;
  padding: $space-6;
  width: 100%;
  max-width: 480px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.25);

  h2 { margin: 0 0 $space-2; color: $color-text-primary; font-size: $font-size-xl; }
}
.sync-sub { margin: 0 0 $space-5; color: $color-text-secondary; font-size: $font-size-sm; }
.sync-options { display: flex; flex-direction: column; gap: $space-2; }
.sync-option {
  display: flex; align-items: center; gap: $space-3;
  text-align: left;
  padding: $space-3 $space-4;
  border: 1.5px solid $color-border;
  border-radius: $radius-md;
  background: $color-bg-elevated;
  color: $color-text-primary;
  cursor: pointer;
  transition: all $transition-fast;
  &:hover { border-color: $color-primary; background: $color-bg-hover; }
  &:disabled { opacity: 0.5; cursor: wait; }
}
.sync-option-title { font-weight: $font-weight-semibold; font-size: $font-size-sm; }
.sync-option-desc { font-size: $font-size-xs; color: $color-text-secondary; margin-top: 2px; }
.sync-busy {
  margin-top: $space-4; display: flex; align-items: center; gap: $space-2;
  color: $color-text-secondary; font-size: $font-size-sm;
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
