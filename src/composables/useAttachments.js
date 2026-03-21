import { ref } from 'vue'

/**
 * Attachment types: image, video, audio, file
 * Each attachment: { id, type, name, size, url, mimeType, createdAt, thumbnail? }
 */

// Simple file-to-base64 for localStorage persistence
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function getAttachmentType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'file'
}

function getFileIcon(mimeType, name) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (['pdf'].includes(ext)) return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx'].includes(ext)) return '📊'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '📦'
  if (['js', 'ts', 'py', 'json', 'html', 'css', 'vue'].includes(ext)) return '💻'
  return '📎'
}

export function useAttachments() {
  const isRecording = ref(false)
  const recordingTime = ref(0)
  const mediaRecorder = ref(null)
  const recordingInterval = ref(null)
  const audioChunks = ref([])

  async function processFile(file) {
    const dataUrl = await fileToBase64(file)
    const type = getAttachmentType(file.type)

    return {
      id: crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2),
      type,
      name: file.name,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
      mimeType: file.type,
      url: dataUrl,
      icon: getFileIcon(file.type, file.name),
      createdAt: new Date().toISOString(),
    }
  }

  async function processFiles(fileList) {
    const attachments = []
    for (const file of fileList) {
      // Limit individual file size to 10MB for localStorage
      if (file.size > 10 * 1024 * 1024) {
        console.warn(`File "${file.name}" exceeds 10MB limit, skipping.`)
        continue
      }
      const attachment = await processFile(file)
      attachments.push(attachment)
    }
    return attachments
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      audioChunks.value = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.value.push(e.data)
      }

      recorder.start(200) // collect in 200ms chunks
      mediaRecorder.value = recorder
      isRecording.value = true
      recordingTime.value = 0

      recordingInterval.value = setInterval(() => {
        recordingTime.value++
      }, 1000)

      return true
    } catch (err) {
      console.error('Microphone access denied:', err)
      return false
    }
  }

  function stopRecording() {
    return new Promise((resolve) => {
      if (!mediaRecorder.value) {
        resolve(null)
        return
      }

      mediaRecorder.value.onstop = async () => {
        const blob = new Blob(audioChunks.value, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onload = () => {
          const attachment = {
            id: crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2),
            type: 'audio',
            name: `Recording ${new Date().toLocaleTimeString()}.webm`,
            size: blob.size,
            sizeFormatted: formatFileSize(blob.size),
            mimeType: 'audio/webm',
            url: reader.result,
            icon: '🎙️',
            duration: recordingTime.value,
            createdAt: new Date().toISOString(),
          }
          resolve(attachment)
        }
        reader.readAsDataURL(blob)
      }

      // Stop all tracks
      mediaRecorder.value.stream.getTracks().forEach(t => t.stop())
      mediaRecorder.value.stop()
      mediaRecorder.value = null
      isRecording.value = false
      clearInterval(recordingInterval.value)
      recordingInterval.value = null
    })
  }

  function cancelRecording() {
    if (mediaRecorder.value) {
      mediaRecorder.value.stream.getTracks().forEach(t => t.stop())
      mediaRecorder.value.stop()
      mediaRecorder.value = null
    }
    isRecording.value = false
    recordingTime.value = 0
    clearInterval(recordingInterval.value)
    recordingInterval.value = null
    audioChunks.value = []
  }

  function formatRecordingTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return {
    isRecording,
    recordingTime,
    processFile,
    processFiles,
    startRecording,
    stopRecording,
    cancelRecording,
    formatRecordingTime,
    formatFileSize,
    getFileIcon,
    getAttachmentType,
  }
}
