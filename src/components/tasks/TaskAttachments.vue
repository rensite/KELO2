<script setup>
import { ref, computed } from 'vue'
import { useAttachments } from '../../composables/useAttachments.js'
import {
  Image, Film, Music, FileText, Mic,
  X, Download, Play, Pause, Plus, Eye
} from 'lucide-vue-next'

const props = defineProps({
  attachments: { type: Array, default: () => [] },
})

const emit = defineEmits(['add', 'remove'])

const {
  isRecording,
  recordingTime,
  processFiles,
  startRecording,
  stopRecording,
  cancelRecording,
  formatRecordingTime,
} = useAttachments()

const fileInput = ref(null)
const showAddMenu = ref(false)
const previewAttachment = ref(null)
const playingAudioId = ref(null)
const audioElement = ref(null)

const addMenuItems = [
  { id: 'image', label: 'Image', icon: Image, accept: 'image/*' },
  { id: 'video', label: 'Video', icon: Film, accept: 'video/*' },
  { id: 'audio', label: 'Audio file', icon: Music, accept: 'audio/*' },
  { id: 'file', label: 'File', icon: FileText, accept: '*/*' },
]

let currentAccept = '*/*'

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
  processed.forEach(a => emit('add', a))
  e.target.value = ''
}

async function handleRecordToggle() {
  showAddMenu.value = false
  if (isRecording.value) {
    const attachment = await stopRecording()
    if (attachment) emit('add', attachment)
  } else {
    const started = await startRecording()
    if (!started) {
      alert('Could not access microphone. Please allow microphone access.')
    }
  }
}

function removeAttachment(id) {
  if (playingAudioId.value === id) {
    audioElement.value?.pause()
    playingAudioId.value = null
  }
  emit('remove', id)
}

function openPreview(attachment) {
  previewAttachment.value = attachment
}

function closePreview() {
  previewAttachment.value = null
}

function handleBlockClick(att) {
  if (att.type === 'audio') {
    toggleAudio(att)
  } else if (att.type === 'image' || att.type === 'video') {
    openPreview(att)
  } else {
    downloadAttachment(att)
  }
}

function toggleAudio(attachment) {
  if (playingAudioId.value === attachment.id) {
    audioElement.value?.pause()
    playingAudioId.value = null
  } else {
    if (audioElement.value) audioElement.value.pause()
    audioElement.value = new Audio(attachment.url)
    audioElement.value.play()
    playingAudioId.value = attachment.id
    audioElement.value.onended = () => { playingAudioId.value = null }
  }
}

function downloadAttachment(attachment) {
  const link = document.createElement('a')
  link.href = attachment.url
  link.download = attachment.name
  link.click()
}

function blockIcon(att) {
  if (att.type === 'image') return Image
  if (att.type === 'video') return Film
  if (att.type === 'audio') return Music
  return FileText
}

function blockColor(att) {
  if (att.type === 'image') return 'image'
  if (att.type === 'video') return 'video'
  if (att.type === 'audio') return 'audio'
  return 'file'
}

function fileExt(name) {
  return name?.split('.').pop()?.toUpperCase().slice(0, 4) || ''
}
</script>

<template>
  <div class="task-attachments">
    <!-- Attached items grid + add trigger -->
    <div class="att-grid">
      <!-- Existing attachments as square blocks -->
      <div
        v-for="att in attachments"
        :key="att.id"
        class="att-block"
        :class="[blockColor(att), { playing: playingAudioId === att.id }]"
        @click="handleBlockClick(att)"
        :title="att.name"
      >
        <img
          v-if="att.type === 'image'"
          :src="att.url"
          :alt="att.name"
          class="att-block-img"
          loading="lazy"
        />
        <template v-else>
          <component
            :is="playingAudioId === att.id ? Pause : blockIcon(att)"
            :size="18"
            class="att-block-icon"
          />
          <span class="att-block-ext">{{ fileExt(att.name) }}</span>
        </template>
        <button class="att-block-remove" @click.stop="removeAttachment(att.id)" title="Remove">
          <X :size="9" />
        </button>
      </div>

      <!-- Recording indicator block (shown while recording) -->
      <div v-if="isRecording" class="att-block att-block-rec-active" @click="handleRecordToggle" title="Stop recording">
        <span class="rec-dot"></span>
        <span class="rec-time">{{ formatRecordingTime(recordingTime) }}</span>
      </div>
      <button v-if="isRecording" class="att-block att-block-rec-cancel" @click="cancelRecording" title="Cancel">
        <X :size="14" />
      </button>

      <!-- Single "+" add button with dropdown -->
      <div v-if="!isRecording" class="att-add-wrapper">
        <button
          class="att-block att-block-add"
          title="Add attachment"
          @click="showAddMenu = !showAddMenu"
        >
          <Plus :size="16" :class="{ rotated: showAddMenu }" class="att-add-icon" />
        </button>
        <Transition name="scale">
          <div v-if="showAddMenu" class="att-add-dropdown" @mouseleave="showAddMenu = false">
            <button
              v-for="item in addMenuItems"
              :key="item.id"
              class="att-add-option"
              @click="openFilePicker(item.accept)"
            >
              <component :is="item.icon" :size="15" class="att-add-option-icon" />
              <span>{{ item.label }}</span>
            </button>
            <hr class="att-add-divider" />
            <button class="att-add-option att-add-option-mic" @click="handleRecordToggle">
              <Mic :size="15" class="att-add-option-icon" />
              <span>Record audio</span>
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      multiple
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- Preview modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="previewAttachment" class="att-preview-overlay" @click.self="closePreview">
          <div class="att-preview-modal">
            <button class="att-preview-close" @click="closePreview">
              <X :size="20" />
            </button>
            <div class="att-preview-content">
              <img
                v-if="previewAttachment.type === 'image'"
                :src="previewAttachment.url"
                :alt="previewAttachment.name"
                class="att-preview-image"
              />
              <video
                v-else-if="previewAttachment.type === 'video'"
                :src="previewAttachment.url"
                controls
                autoplay
                class="att-preview-video"
              />
            </div>
            <div class="att-preview-footer">
              <span>{{ previewAttachment.name }}</span>
              <span class="att-preview-size">{{ previewAttachment.sizeFormatted }}</span>
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

.task-attachments {
  padding: $space-2 0 $space-1;
}

// ─── Unified Grid ────────────────────────────────────────
.att-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

// ─── Square Block (base) ─────────────────────────────────
.att-block {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: $radius-md;
  overflow: hidden;
  cursor: pointer;
  border: 1.5px solid $color-border;
  @include flex-center;
  flex-direction: column;
  gap: 2px;
  transition: all $transition-fast;
  flex-shrink: 0;
  background: $color-bg-elevated;

  &:hover {
    transform: scale(1.08);
    box-shadow: $shadow-md;
    
    .att-block-remove { opacity: 1; }
  }

  // ── Image block ──────────────
  &.image {
    border-color: rgba($violet-500, 0.2);

    &:hover { border-color: $violet-500; }
  }

  // ── Audio block ──────────────
  &.audio {
    background: rgba($violet-500, 0.06);
    border-color: rgba($violet-500, 0.15);
    
    .att-block-icon { color: $violet-600; }
    .att-block-ext { color: $violet-500; }

    &:hover { border-color: $violet-500; background: rgba($violet-500, 0.1); }
    &.playing {
      border-color: $violet-500;
      background: rgba($violet-500, 0.12);
      box-shadow: 0 0 0 2px rgba($violet-500, 0.15);

      .att-block-icon { color: $violet-700; }
    }
  }

  // ── Video block ──────────────
  &.video {
    background: rgba($blue-500, 0.06);
    border-color: rgba($blue-500, 0.15);
    
    .att-block-icon { color: $blue-500; }
    .att-block-ext { color: $blue-500; }

    &:hover { border-color: $blue-500; background: rgba($blue-500, 0.1); }
  }

  // ── File block ───────────────
  &.file {
    background: rgba($gray-400, 0.06);
    border-color: rgba($gray-400, 0.2);
    
    .att-block-icon { color: $gray-500; }
    .att-block-ext { color: $gray-500; }

    &:hover { border-color: $gray-500; background: rgba($gray-400, 0.1); }
  }

  // ── Add "+" trigger ───────────
  &.att-block-add {
    border-style: dashed;
    border-color: $color-border;
    background: transparent;
    color: $color-text-muted;
    padding: 0;
    width: 42px;
    height: 42px;
    overflow: visible;

    &:hover {
      border-color: $color-primary;
      color: $color-primary;
      background: rgba($violet-500, 0.06);
      transform: scale(1.1);
    }
  }

  // ── Recording active ─────────
  &.att-block-rec-active {
    border-color: $rose-500;
    background: rgba($rose-500, 0.06);
    color: $rose-500;
    width: auto;
    min-width: 52px;
    padding: 0 10px;
    gap: 5px;
    flex-direction: row;
    cursor: pointer;

    &:hover { background: rgba($rose-500, 0.12); }
  }

  &.att-block-rec-cancel {
    border-color: rgba($rose-500, 0.25);
    background: transparent;
    color: $color-text-muted;
    width: 42px;
    height: 42px;

    &:hover {
      border-color: $rose-500;
      color: $rose-500;
      background: rgba($rose-500, 0.06);
    }
  }
}

// ─── Add wrapper (dropdown anchor) ──────────────────────
.att-add-wrapper {
  position: relative;
}

.att-add-icon {
  transition: transform $transition-fast;
  
  &.rotated { transform: rotate(45deg); }
}

.att-add-dropdown {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  min-width: 160px;
  padding: 4px;
  background: $color-bg-elevated;
  border: 1px solid $color-border;
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  z-index: $z-dropdown;
}

.att-add-option {
  display: flex;
  align-items: center;
  gap: $space-2;
  width: 100%;
  padding: 7px $space-3;
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

  &.att-add-option-mic {
    color: $violet-600;
    .att-add-option-icon { color: $violet-600; }
    &:hover { background: rgba($violet-500, 0.08); }
  }
}

.att-add-option-icon {
  color: $color-text-muted;
  flex-shrink: 0;
}

.att-add-divider {
  margin: 3px 0;
  border: none;
  border-top: 1px solid $color-border;
}

// ─── Block innards ───────────────────────────────────────
.att-block-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.att-block-icon {
  flex-shrink: 0;
}

.att-block-ext {
  font-size: 8px;
  font-weight: $font-weight-bold;
  letter-spacing: 0.04em;
  line-height: 1;
  text-transform: uppercase;
  @include truncate;
  max-width: 40px;
}

.att-block-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: $radius-full;
  background: rgba(0, 0, 0, 0.55);
  color: white;
  border: none;
  cursor: pointer;
  @include flex-center;
  opacity: 0;
  transition: all $transition-fast;

  &:hover { background: $rose-500; transform: scale(1.15); }
}

// ─── Recording indicator ────────────────────────────────
.rec-dot {
  width: 7px;
  height: 7px;
  border-radius: $radius-full;
  background: $rose-500;
  animation: attPulse 1s ease-in-out infinite;
  flex-shrink: 0;
}

.rec-time {
  font-size: 10px;
  font-weight: $font-weight-semibold;
  font-variant-numeric: tabular-nums;
}

@keyframes attPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

// ─── Preview modal ──────────────────────────────────────
.att-preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  z-index: $z-modal;
  @include flex-center;
}

.att-preview-modal {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  border-radius: $radius-xl;
  overflow: hidden;
  background: $color-bg-elevated;
  box-shadow: $shadow-xl;
}

.att-preview-close {
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

.att-preview-content {
  @include flex-center;
}

.att-preview-image {
  max-width: 90vw;
  max-height: 80vh;
  object-fit: contain;
}

.att-preview-video {
  max-width: 90vw;
  max-height: 80vh;
}

.att-preview-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $space-2 $space-3;
  font-size: $font-size-xs;
  color: $color-text-secondary;
  background: $color-bg;
  border-top: 1px solid $color-border;
}

.att-preview-size {
  color: $color-text-muted;
}
</style>
