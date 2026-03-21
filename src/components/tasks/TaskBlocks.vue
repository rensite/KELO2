<script setup>
import { ref, computed, nextTick, watch, reactive, onMounted } from 'vue'
import { useTaskStore } from '../../stores/tasks.js'
import { useAttachments } from '../../composables/useAttachments.js'
import { loadMedia, deleteMedia } from '../../stores/mediaDB.js'
import { useToast } from '../../composables/useToast.js'
import RichText from './RichText.vue'
import {
  Circle, CheckCircle2, GripHorizontal, X,
  Image, Film, Music, FileText, Mic, Plus,
  Play, Pause, Download, Eye, Clock
} from 'lucide-vue-next'

const props = defineProps({
  taskId: { type: String, required: true },
  blocks: { type: Array, default: () => [] },
})

const tasks = useTaskStore()
const { undoToast } = useToast()
const {
  isRecording,
  recordingTime,
  processFiles,
  startRecording,
  stopRecording,
  cancelRecording,
  formatRecordingTime,
  pickFile,
  readFileAsDataURL,
} = useAttachments()

const fileInput = ref(null)
const showAddMenu = ref(false)
const newBlockText = ref('')
const editingBlockId = ref(null)
const editBlockText = ref('')
const editBlockInput = ref(null)
const draggedBlock = ref(null)
const playingAudioId = ref(null)
const audioElement = ref(null)

// Media URL cache from IndexedDB
const mediaUrls = reactive({})

function mediaUrl(block) {
  return mediaUrls[block.mediaId || block.id] || block.url || ''
}

async function loadBlockMedia() {
  for (const block of props.blocks) {
    if (block.mediaId && !mediaUrls[block.mediaId]) {
      const url = await loadMedia(block.mediaId)
      if (url) mediaUrls[block.mediaId] = url
    }
  }
}

watch(() => props.blocks.length, loadBlockMedia)
onMounted(loadBlockMedia)
const previewBlock = ref(null)
const expandedBlocks = ref(new Set())
const datePickerBlockId = ref(null)
const datePickerInput = ref(null)

function toggleExpand(blockId) {
  if (expandedBlocks.value.has(blockId)) {
    expandedBlocks.value.delete(blockId)
  } else {
    expandedBlocks.value.add(blockId)
  }
}

// ─── Datetime for text blocks ────────────────────────
function openDatePicker(block) {
  datePickerBlockId.value = block.id
  nextTick(() => datePickerInput.value?.showPicker?.())
}

function setBlockDueAt(block, e) {
  const val = e.target.value
  if (val) {
    tasks.updateBlock(props.taskId, block.id, { dueAt: val })
  }
  datePickerBlockId.value = null
}

function clearBlockDueAt(block) {
  tasks.updateBlock(props.taskId, block.id, { dueAt: null })
}

function formatDueAt(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const tom = new Date(now); tom.setDate(tom.getDate() + 1)
  const isTomorrow = d.toDateString() === tom.toDateString()
  const time = d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (isToday) return `Today ${time}`
  if (isTomorrow) return `Tomorrow ${time}`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ` ${time}`
}

function dueAtClass(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d < new Date() ? 'overdue' : ''
}

function deleteBlockWithUndo(block) {
  const task = tasks.items.find(t => t.id === props.taskId)
  if (!task) return
  const idx = task.blocks.findIndex(b => b.id === block.id)
  const blockCopy = { ...block }
  tasks.deleteBlock(props.taskId, block.id)
  if (block.mediaId) deleteMedia(block.mediaId)
  const label = block.type === 'text' ? block.text : block.name
  undoToast(`Deleted "${label || 'block'}"`, () => {
    task.blocks.splice(idx, 0, blockCopy)
  })
}

const addMenuItems = [
  { id: 'image', label: 'Image', icon: Image, accept: 'image/*' },
  { id: 'video', label: 'Video', icon: Film, accept: 'video/*' },
  { id: 'audio', label: 'Audio file', icon: Music, accept: 'audio/*' },
  { id: 'file', label: 'File', icon: FileText, accept: '*/*' },
]

let currentAccept = '*/*'

// ─── Text blocks (subtask-like) ──────────────────────
const textBlocks = computed(() => props.blocks.filter(b => b.type === 'text'))
const textProgress = computed(() => {
  if (!textBlocks.value.length) return null
  const done = textBlocks.value.filter(b => b.completed).length
  return { done, total: textBlocks.value.length, pct: Math.round((done / textBlocks.value.length) * 100) }
})

function addTextBlock(e) {
  if (newBlockText.value.trim()) {
    tasks.addBlock(props.taskId, { type: 'text', text: newBlockText.value.trim(), completed: false })
    newBlockText.value = ''
    nextTick(() => {
      if (e?.target) e.target.style.height = 'auto'
    })
  }
}

function startEditBlock(block) {
  editingBlockId.value = block.id
  editBlockText.value = block.text
  nextTick(() => {
    const el = editBlockInput.value
    if (el) {
      el.rows = block.text.length > 80 ? 3 : 1
      el.focus()
      autoResizeTextarea(el)
    }
  })
}

function autoResizeTextarea(el) {
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 200) + 'px'
}

function saveBlockEdit(block) {
  if (editBlockText.value.trim()) {
    tasks.updateBlock(props.taskId, block.id, { text: editBlockText.value.trim() })
  }
  editingBlockId.value = null
}

function cancelBlockEdit() {
  editingBlockId.value = null
}

// ─── Media blocks ────────────────────────────────────
function openFilePicker(accept) {
  currentAccept = accept
  showAddMenu.value = false
  if (fileInput.value) {
    fileInput.value.accept = accept
    fileInput.value.click()
  }
}

async function handleFileSelect(e) {
  const files = e.target.files
  if (!files?.length) return
  const processed = await processFiles(files)
  processed.forEach(a => {
    tasks.addBlock(props.taskId, { type: a.type, name: a.name, url: a.url, size: a.size, sizeFormatted: a.sizeFormatted, mimeType: a.mimeType, icon: a.icon, duration: a.duration })
  })
  e.target.value = ''
}

async function handleRecordToggle() {
  showAddMenu.value = false
  if (isRecording.value) {
    const att = await stopRecording()
    if (att) {
      tasks.addBlock(props.taskId, { type: att.type, name: att.name, url: att.url, size: att.size, sizeFormatted: att.sizeFormatted, mimeType: att.mimeType, duration: att.duration })
    }
  } else {
    const started = await startRecording()
    if (!started) alert('Could not access microphone.')
  }
}

function handleBlockClick(block) {
  if (block.type === 'audio') toggleAudio(block)
  else if (block.type === 'image' || block.type === 'video') previewBlock.value = block
  else downloadBlock(block)
}

function toggleAudio(block) {
  if (playingAudioId.value === block.id) {
    audioElement.value?.pause()
    playingAudioId.value = null
  } else {
    if (audioElement.value) audioElement.value.pause()
    audioElement.value = new Audio(mediaUrl(block))
    audioElement.value.play()
    playingAudioId.value = block.id
    audioElement.value.onended = () => { playingAudioId.value = null }
  }
}

function downloadBlock(block) {
  const link = document.createElement('a')
  link.href = mediaUrl(block)
  link.download = block.name
  link.click()
}

function closePreview() {
  previewBlock.value = null
}

// ─── Drag reorder ────────────────────────────────────
function onDragStart(e, block) {
  draggedBlock.value = block
  e.dataTransfer.effectAllowed = 'move'
  e.target.classList.add('dragging')
}

function onDragOver(e) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
}

function onDrop(e, targetBlock) {
  e.preventDefault()
  if (!draggedBlock.value || !props.blocks) return
  const blocks = [...props.blocks]
  const fromIdx = blocks.findIndex(b => b.id === draggedBlock.value.id)
  const toIdx = blocks.findIndex(b => b.id === targetBlock.id)
  if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
    const [moved] = blocks.splice(fromIdx, 1)
    blocks.splice(toIdx, 0, moved)
    tasks.reorderBlocks(props.taskId, blocks)
  }
  draggedBlock.value = null
}

function onDragEnd(e) {
  e.target.classList.remove('dragging')
  draggedBlock.value = null
}

// ─── Helpers ─────────────────────────────────────────
function mediaIcon(block) {
  if (block.type === 'image') return Image
  if (block.type === 'video') return Film
  if (block.type === 'audio') return Music
  return FileText
}

function fileExt(name) {
  return name?.split('.').pop()?.toUpperCase().slice(0, 4) || ''
}
</script>

<template>
  <div class="task-blocks" v-if="blocks.length">

    <!-- Block list -->
    <div class="blocks-list">
      <div
        v-for="block in blocks"
        :key="block.id"
        class="block-row"
        :class="[
          `block-type-${block.type}`,
          {
            done: block.completed,
            dragging: draggedBlock?.id === block.id,
            playing: playingAudioId === block.id,
          }
        ]"
        draggable="true"
        @dragstart="(e) => onDragStart(e, block)"
        @dragover="onDragOver"
        @drop="(e) => onDrop(e, block)"
        @dragend="onDragEnd"
      >
        <div class="block-drag-handle">
          <GripHorizontal :size="11" />
        </div>

        <!-- Shared check button for ALL block types -->
        <button class="block-check" @click="tasks.toggleBlockComplete(taskId, block.id)">
          <CheckCircle2 v-if="block.completed" :size="15" />
          <Circle v-else :size="15" />
        </button>

        <!-- TEXT block -->
        <template v-if="block.type === 'text'">
          <template v-if="editingBlockId === block.id">
            <textarea
              ref="editBlockInput"
              v-model="editBlockText"
              class="block-edit-input"
              rows="1"
              @keydown.ctrl.enter="saveBlockEdit(block)"
              @keydown.meta.enter="saveBlockEdit(block)"
              @keydown.escape="cancelBlockEdit"
              @blur="saveBlockEdit(block)"
              @input="autoResizeTextarea($event.target)"
            />
          </template>
          <template v-else>
            <span
              class="block-text"
              @dblclick="startEditBlock(block)"
            >
              <RichText :text="block.text" :completed="block.completed" />
            </span>
            <span
              v-if="block.dueAt && formatDueAt(block.dueAt)"
              class="block-due-badge"
              :class="dueAtClass(block.dueAt)"
              @click="openDatePicker(block)"
            >
              <Clock :size="10" />
              {{ formatDueAt(block.dueAt) }}
              <button class="block-due-clear" @click.stop="clearBlockDueAt(block)"><X :size="9" /></button>
            </span>
            <button
              v-else
              class="block-due-trigger"
              title="Set time"
              @click="openDatePicker(block)"
            >
              <Clock :size="11" />
            </button>
            <input
              v-if="datePickerBlockId === block.id"
              ref="datePickerInput"
              type="datetime-local"
              class="block-due-picker"
              :value="block.dueAt || ''"
              @change="(e) => setBlockDueAt(block, e)"
              @blur="datePickerBlockId = null"
            />
          </template>
        </template>

        <!-- IMAGE block -->
        <template v-else-if="block.type === 'image'">
          <div class="block-media-thumb" @click="handleBlockClick(block)">
            <img :src="mediaUrl(block)" :alt="block.name" loading="lazy" />
            <div class="block-media-hover"><Eye :size="13" /></div>
          </div>
          <span class="block-media-name" :class="{ done: block.completed }">{{ block.name }}</span>
        </template>

        <!-- AUDIO block -->
        <template v-else-if="block.type === 'audio'">
          <button class="block-audio-play" @click.stop="toggleAudio(block)">
            <Pause v-if="playingAudioId === block.id" :size="12" />
            <Play v-else :size="12" />
          </button>
          <span class="block-media-name" :class="{ done: block.completed }">{{ block.name }}</span>
          <span class="block-media-meta">{{ block.sizeFormatted }}</span>
        </template>

        <!-- VIDEO block -->
        <template v-else-if="block.type === 'video'">
          <div class="block-media-thumb video-thumb" @click="handleBlockClick(block)">
            <Film :size="16" />
          </div>
          <span class="block-media-name" :class="{ done: block.completed }">{{ block.name }}</span>
        </template>

        <!-- FILE block -->
        <template v-else>
          <span class="block-file-icon">{{ block.icon || '📄' }}</span>
          <span class="block-media-name" :class="{ done: block.completed }">{{ block.name }}</span>
          <span class="block-media-meta">{{ block.sizeFormatted }}</span>
          <button class="block-action-sm" @click.stop="downloadBlock(block)" title="Download">
            <Download :size="11" />
          </button>
        </template>

        <!-- Delete -->
        <button class="block-delete" @click="deleteBlockWithUndo(block)">
          <X :size="12" />
        </button>
      </div>
    </div>

    <!-- Preview modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="previewBlock" class="blocks-preview-overlay" @click.self="closePreview">
          <div class="blocks-preview-modal">
            <button class="blocks-preview-close" @click="closePreview"><X :size="20" /></button>
            <div class="blocks-preview-content">
              <img v-if="previewBlock.type === 'image'" :src="mediaUrl(previewBlock)" :alt="previewBlock.name" class="blocks-preview-img" />
              <video v-else-if="previewBlock.type === 'video'" :src="mediaUrl(previewBlock)" controls autoplay class="blocks-preview-vid" />
            </div>
            <div class="blocks-preview-footer">
              <span>{{ previewBlock.name }}</span>
              <span class="blocks-preview-size">{{ previewBlock.sizeFormatted }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss">
@use 'variables' as *;
@use 'mixins' as *;

.task-blocks {
  padding: $space-2 $space-3 $space-1;
  border-top: 1px solid rgba($color-border, 0.5);
}


// ─── Block list ──────────────────────────────────────
.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.block-row {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: 5px $space-2 5px 0;
  border-radius: $radius-sm;
  transition: all $transition-fast;
  position: relative;
  min-height: 30px;

  &:hover {
    background: rgba($violet-500, 0.03);
    .block-drag-handle { opacity: 0.5; }
    .block-delete { opacity: 1; }
    .block-due-trigger { opacity: 0.5; }
  }

  &.dragging { opacity: 0.35; }

  &.done .block-text { color: $color-text-muted; }
  &.done .block-check { color: $emerald-500; }
  &.done .block-media-thumb { opacity: 0.5; }
  &.done .block-file-icon { opacity: 0.5; }
}

.block-drag-handle {
  @include flex-center;
  width: 18px;
  flex-shrink: 0;
  color: $color-text-muted;
  opacity: 0;
  cursor: grab;
  transition: opacity $transition-fast;

  &:active { cursor: grabbing; }
}

// ─── Text block ──────────────────────────────────────
.block-check {
  @include btn-icon(22px);
  color: $color-text-muted;
  flex-shrink: 0;
  border-radius: $radius-full;
  opacity: 0;
  transition: opacity $transition-fast;

  .block-row:hover & { opacity: 1; }
  .block-row.done & { opacity: 1; }
}

.block-text {
  flex: 1;
  font-size: $font-size-sm;
  color: $color-text-primary;
  cursor: default;
  min-width: 0;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 10;
  line-clamp: 10;
  -webkit-box-orient: vertical;
  overflow: hidden;

  .rich-text {
    font-size: $font-size-sm;
  }
}

.block-edit-input {
  flex: 1;
  font-size: $font-size-sm;
  padding: 4px 6px;
  border: 1.5px solid $color-primary;
  border-radius: $radius-sm;
  outline: none;
  background: $color-bg;
  font-family: $font-family;
  color: $color-text-primary;
  line-height: $line-height-normal;
  resize: none;
  overflow-y: auto;
  max-height: 200px;
}

// ─── Inline due datetime ─────────────────────────────
.block-due-trigger {
  @include btn-icon(18px);
  color: $color-text-muted;
  opacity: 0;
  flex-shrink: 0;
  transition: opacity $transition-fast;

  .block-row:hover & { opacity: 0.5; }
  &:hover { opacity: 1 !important; color: $color-primary; }
}

.block-due-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border-radius: $radius-full;
  font-size: 10px;
  font-weight: $font-weight-medium;
  background: rgba($violet-500, 0.08);
  color: $violet-600;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
  transition: all $transition-fast;

  &:hover { background: rgba($violet-500, 0.14); }

  &.overdue {
    background: rgba($rose-500, 0.08);
    color: $rose-500;
    &:hover { background: rgba($rose-500, 0.14); }
  }
}

.block-due-clear {
  @include btn-icon(14px);
  color: inherit;
  opacity: 0.5;
  margin-left: 1px;

  &:hover { opacity: 1; }
}

.block-due-picker {
  position: absolute;
  right: 0;
  top: 0;
  opacity: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: all;
}

// ─── Media blocks (image, audio, video, file) ────────
.block-media-thumb {
  width: 34px;
  height: 34px;
  border-radius: $radius-sm;
  overflow: hidden;
  flex-shrink: 0;
  cursor: pointer;
  position: relative;
  border: 1.5px solid rgba($violet-500, 0.15);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &.video-thumb {
    @include flex-center;
    background: rgba($blue-500, 0.08);
    border-color: rgba($blue-500, 0.15);
    color: $blue-500;
  }

  &:hover .block-media-hover { opacity: 1; }
}

.block-media-hover {
  position: absolute;
  inset: 0;
  @include flex-center;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  opacity: 0;
  transition: opacity $transition-fast;
}

.block-media-name {
  flex: 1;
  font-size: $font-size-xs;
  color: $color-text-secondary;
  min-width: 0;
  @include truncate;

  &.done {
    text-decoration: line-through;
    color: $color-text-muted;
  }
}

.block-media-meta {
  font-size: 10px;
  color: $color-text-muted;
  flex-shrink: 0;
}

.block-audio-play {
  @include btn-icon(24px);
  background: $gradient-primary;
  color: white;
  border-radius: $radius-full;
  flex-shrink: 0;

  &:hover { transform: scale(1.1); box-shadow: $shadow-glow; }
}

.block-file-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.block-action-sm {
  @include btn-icon(20px);
  color: $color-text-muted;
  flex-shrink: 0;

  &:hover { color: $color-primary; background: $color-bg-hover; }
}

// ─── Delete button ───────────────────────────────────
.block-delete {
  @include btn-icon(20px);
  color: $color-text-muted;
  opacity: 0;
  transition: all $transition-fast;
  flex-shrink: 0;
  margin-left: auto;

  &:hover { color: $rose-500; background: rgba($rose-500, 0.1); }
}

// ─── Add row ─────────────────────────────────────────
.blocks-add-row {
  display: flex;
  align-items: center;
  gap: $space-1;
  margin-top: $space-1;
  padding-left: 37px;
}

.blocks-add-input {
  flex: 1;
  font-size: $font-size-sm;
  padding: 6px 10px;
  border: 1.5px solid transparent;
  border-radius: $radius-md;
  background: $color-bg-hover;
  outline: none;
  font-family: $font-family;
  color: $color-text-primary;
  line-height: $line-height-normal;
  resize: none;
  overflow-y: auto;
  max-height: 200px;
  transition: all $transition-fast;

  &::placeholder { color: $color-text-muted; }
  &:focus {
    border-color: $color-primary;
    background: $color-bg;
    box-shadow: 0 0 0 2px rgba($violet-500, 0.1);
  }
}

.blocks-add-menu-wrapper {
  position: relative;
}

.blocks-add-trigger {
  @include btn-icon(28px);
  border-radius: $radius-md;
  border: 1.5px dashed $color-border;
  color: $color-text-muted;
  background: transparent;

  &:hover, &.open {
    border-color: $color-primary;
    color: $color-primary;
    background: rgba($violet-500, 0.06);
  }
}

.blocks-add-plus {
  transition: transform $transition-fast;
  &.rotated { transform: rotate(45deg); }
}

.blocks-add-dropdown {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  min-width: 155px;
  padding: 4px;
  background: $color-bg-elevated;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  z-index: $z-dropdown;
}

.blocks-add-option {
  display: flex;
  align-items: center;
  gap: $space-2;
  width: 100%;
  padding: 6px $space-3;
  border: none;
  border-radius: $radius-sm;
  background: none;
  font-size: $font-size-sm;
  color: $color-text-primary;
  cursor: pointer;
  text-align: left;
  font-family: $font-family;
  transition: background $transition-fast;

  &:hover { background: $color-bg-hover; }

  &.blocks-add-option-mic {
    color: $violet-600;
    .blocks-add-option-icon { color: $violet-600; }
    &:hover { background: rgba($violet-500, 0.08); }
  }
}

.blocks-add-option-icon {
  color: $color-text-muted;
  flex-shrink: 0;
}

.blocks-add-divider {
  margin: 3px 0;
  border: none;
  border-top: 1px solid $color-border;
}

// ─── Recording bar ───────────────────────────────────
.blocks-recording {
  display: flex;
  align-items: center;
  gap: $space-2;
  padding: $space-2 $space-3;
  margin-top: $space-1;
  border-radius: $radius-md;
  background: rgba($rose-500, 0.06);
  border: 1px solid rgba($rose-500, 0.15);
  color: $rose-500;
  font-size: $font-size-sm;
}

.rec-dot {
  width: 7px;
  height: 7px;
  border-radius: $radius-full;
  background: $rose-500;
  animation: blockPulse 1s ease-in-out infinite;
  flex-shrink: 0;
}

.rec-time {
  font-weight: $font-weight-semibold;
  font-variant-numeric: tabular-nums;
  font-size: $font-size-xs;
}

.rec-stop, .rec-cancel {
  padding: 2px 8px;
  border-radius: $radius-sm;
  border: 1px solid rgba($rose-500, 0.3);
  background: none;
  font-size: $font-size-xs;
  font-family: $font-family;
  cursor: pointer;
  color: $rose-500;

  &:hover { background: rgba($rose-500, 0.08); }
}

.rec-cancel {
  color: $color-text-muted;
  border-color: $color-border;
}

@keyframes blockPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

// ─── Preview modal ───────────────────────────────────
.blocks-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: $z-modal;
  @include flex-center;
}

.blocks-preview-modal {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  border-radius: $radius-xl;
  overflow: hidden;
  background: $color-bg-elevated;
  box-shadow: $shadow-xl;
}

.blocks-preview-close {
  position: absolute;
  top: $space-3;
  right: $space-3;
  @include btn-icon(36px);
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: $radius-full;
  z-index: 1;

  &:hover { background: rgba(0, 0, 0, 0.7); }
}

.blocks-preview-content { @include flex-center; }
.blocks-preview-img { max-width: 90vw; max-height: 80vh; object-fit: contain; }
.blocks-preview-vid { max-width: 90vw; max-height: 80vh; }

.blocks-preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $space-2 $space-3;
  font-size: $font-size-xs;
  color: $color-text-secondary;
  background: $color-bg;
  border-top: 1px solid $color-border;
}

.blocks-preview-size { color: $color-text-muted; }
</style>
